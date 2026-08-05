import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import supabase from '../lib/supabaseClient';
import { getEvalSession } from './authClient';

const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:3001';

async function reset() {
  console.log('clearing old documents/chunks before eval run...');
  const { userId, authHeader } = await getEvalSession();

  // chunks cascade-delete via the document_id FK, so clearing documents is enough.
  // scoped to the eval service account's own rows, same as every other user's data
  const { error } = await supabase.from('documents').delete().eq('user_id', userId);
  if (error) throw new Error(`failed to clear documents: ${error.message}`);

  // overridable so the same reset+eval flow can run against a different corpus,
  // e.g. EVAL_CORPUS_FILE=hindi_corpus.txt for the Hindi eval
  const corpusFile = process.env.EVAL_CORPUS_FILE ?? 'corpus.txt';
  const corpusPath = path.join(__dirname, corpusFile);
  const fileBuffer = fs.readFileSync(corpusPath);

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: 'text/plain' }), corpusFile);

  const res = await fetch(`${API_URL}/api/ingest`, { method: 'POST', headers: authHeader, body: form });
  if (!res.ok) throw new Error(`failed to re-ingest corpus: ${res.status}`);

  const data = await res.json() as { chunksIngested: number };
  console.log(`corpus re-ingested: ${data.chunksIngested} chunks\n`);
}

reset().catch(err => {
  console.error(err);
  process.exit(1);
});
