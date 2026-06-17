import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import upload from '../middleware/upload';
import { chunkText } from '../services/chunker';
import { isUsableChunk } from '../services/scorer';
import { embedChunks } from '../services/embedder';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'no file uploaded' });
    return;
  }

  const text = req.file.buffer.toString('utf-8');
  const filename = req.file.originalname;

  const rawChunks = chunkText(text);
  const usableChunks = rawChunks.filter(isUsableChunk);

  if (usableChunks.length === 0) {
    res.status(422).json({ error: 'document produced no usable chunks' });
    return;
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ filename })
    .select()
    .single();

  if (docError || !doc) {
    res.status(500).json({ error: 'failed to save document record' });
    return;
  }

  const embeddings = await embedChunks(usableChunks);

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
    chunksIngested: usableChunks.length,
  });
});

export default router;
