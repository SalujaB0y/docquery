import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });

    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);

    embeddings.push(...batchEmbeddings);

    if (i + BATCH_SIZE < chunks.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return embeddings;
}
