import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// below this score we don't have a useful match — 0.4 is the right floor for text-embedding-3-small
const SIMILARITY_THRESHOLD = 0.25;
const TOP_K = 5;

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  chunk_index: number;
  token_count: number;
};

export async function retrieveChunks(
  question: string,
  documentId?: string
): Promise<RetrievedChunk[]> {
  const embeddingResponse = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: TOP_K,
    // null searches every document, which is what the eval and the "All documents" option do
    filter_document_id: documentId ?? null,
  });

  if (error) throw new Error(`retrieval failed: ${error.message}`);

  return (data ?? []) as RetrievedChunk[];
}
