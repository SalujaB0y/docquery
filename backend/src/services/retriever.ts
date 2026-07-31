import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// below this score we don't have a useful match. worth knowing what this actually buys:
// against the eval's hard negatives it only catches questions that are off-topic outright
// (1 of 11) — topically adjacent but unanswerable ones clear 0.25 and get refused by the
// generator prompt instead. so this is a coarse filter, not the main fallback mechanism.
//
// 0.25 is tuned against English content specifically — it doesn't transfer to other
// languages. A full sweep against a Hindi eval corpus (hindi_corpus.txt / hindi_pairs.json,
// `npm run eval:hindi`) found 0.25 and 0.20 both cap retrieval hit rate at 78.6% (missing
// real, on-topic content), while 0.15 clears 100% with zero cost to fallback accuracy.
// 0.10 performs identically to 0.15 but leaves the threshold doing no real filtering work
// (0 of 5 hard negatives caught by it, vs 1 at 0.15), so 0.15 is the better of the two, not
// just "lower is safer." A deployment serving Hindi content should set
// SIMILARITY_THRESHOLD=0.15 rather than inherit the English-tuned default.
const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD ?? 0.25);
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
  documentIds?: string[]
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
    // null searches every document, which is what the eval and an empty selection do.
    // an empty array here would match nothing (`= any('{}')`), not everything, so an
    // empty/undefined list must collapse to null rather than being passed through
    filter_document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
  });

  if (error) throw new Error(`retrieval failed: ${error.message}`);

  return (data ?? []) as RetrievedChunk[];
}
