import { Router, Request, Response } from 'express';
import pdfParse from 'pdf-parse';
import supabase from '../lib/supabaseClient';
import crypto from 'crypto';
import upload from '../middleware/upload';
import { chunkText } from '../services/chunker';
import { isUsableChunk } from '../services/scorer';
import { embedChunks } from '../services/embedder';
import { summarizeDocument } from '../services/summarizer';

const router = Router();

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'no file uploaded' });
    return;
  }

  let text: string;
  if (req.file.mimetype === 'application/pdf') {
    try {
      text = (await pdfParse(req.file.buffer)).text;
    } catch {
      res.status(422).json({ error: 'could not read this PDF — it may be scanned/image-only or corrupted' });
      return;
    }
  } else {
    text = req.file.buffer.toString('utf-8');
  }

  const filename = req.file.originalname;
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');
  // multer parses non-file fields into req.body; empty string from a "root" picker
  // option should mean unfiled, same as omitting it
  const folderId = (req.body.folderId as string | undefined) || null;

  // exact duplicate — identical content already ingested, possibly under a different
  // filename. skip re-ingesting entirely rather than paying for embeddings again and
  // leaving a second copy of the same chunks competing in retrieval.
  const { data: exactMatch } = await supabase
    .from('documents')
    .select('id, filename, folder_id, summary, chunks(count)')
    .eq('content_hash', contentHash)
    .eq('user_id', req.userId)
    .maybeSingle();

  if (exactMatch) {
    res.json({
      documentId: exactMatch.id,
      filename: exactMatch.filename,
      folderId: exactMatch.folder_id,
      summary: exactMatch.summary,
      chunksIngested: (exactMatch.chunks as { count: number }[])[0]?.count ?? 0,
      duplicate: true,
    });
    return;
  }

  // same filename, different content — treat as an updated version of the same document
  // (a corrected transcript, say) and replace it, rather than leaving the old chunks
  // around to keep competing in retrieval against the new ones. chunks cascade-delete
  // via the document_id FK. scoped to folder rather than filename alone, so "notes.txt"
  // in one folder doesn't clobber an unrelated "notes.txt" in another.
  let sameNameQuery = supabase.from('documents').select('id').eq('filename', filename).eq('user_id', req.userId);
  sameNameQuery = folderId
    ? sameNameQuery.eq('folder_id', folderId)
    : sameNameQuery.is('folder_id', null);
  const { data: sameNameDoc } = await sameNameQuery.maybeSingle();

  if (sameNameDoc) {
    await supabase.from('documents').delete().eq('id', sameNameDoc.id);
  }

  const rawChunks = chunkText(text);
  const usableChunks = rawChunks.filter(isUsableChunk);

  if (usableChunks.length === 0) {
    res.status(422).json({ error: 'document produced no usable chunks' });
    return;
  }

  // run in parallel — the summary reads the raw text, embedding reads the chunks, neither
  // depends on the other's result
  const [summary, embeddings] = await Promise.all([
    summarizeDocument(text),
    embedChunks(usableChunks),
  ]);

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ filename, content_hash: contentHash, folder_id: folderId, summary, user_id: req.userId })
    .select()
    .single();

  if (docError || !doc) {
    res.status(500).json({ error: 'failed to save document record' });
    return;
  }

  const rows = usableChunks.map((content, i) => ({
    document_id: doc.id,
    content,
    chunk_index: i,
    // rough token estimate — tiktoken WASM can be fiddly so we approximate
    token_count: Math.ceil(content.length / 4),
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error: chunkError } = await supabase.from('chunks').insert(rows);

  if (chunkError) {
    res.status(500).json({ error: 'failed to save chunks' });
    return;
  }

  console.log(`ingested ${filename}: ${rawChunks.length} raw chunks, ${usableChunks.length} kept`);

  res.json({
    documentId: doc.id,
    filename,
    folderId: doc.folder_id,
    summary: doc.summary,
    chunksIngested: usableChunks.length,
  });
});

export default router;
