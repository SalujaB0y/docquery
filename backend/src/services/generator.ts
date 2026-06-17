import OpenAI from 'openai';
import { RetrievedChunk } from './retriever';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TOKENS_PER_REQUEST = 3000;
// gpt-4o-mini input pricing as of 2024
const COST_PER_1K_INPUT_TOKENS = 0.00015;

export type GeneratorResult = {
  answer: string;
  sources: { index: number; content: string }[];
  tokenCount: number;
  estimatedCost: number;
};

function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n');

  return `You are a helpful assistant that answers questions based only on the provided document excerpts.
Cite your sources using [1], [2], etc. in your answer. If the excerpts don't contain enough information to answer the question, say exactly: "I don't have enough information in the uploaded documents to answer this."

Document excerpts:
${context}

Question: ${question}`;
}

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<GeneratorResult> {
  // if the context would be too large, fall back to top 3
  const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);
  const activeChunks = totalTokens > MAX_TOKENS_PER_REQUEST
    ? chunks.slice(0, 3)
    : chunks;

  const prompt = buildPrompt(question, activeChunks);
  const promptTokens = Math.ceil(prompt.length / 4);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const answer = response.choices[0].message.content ?? '';
  const tokenCount = response.usage?.total_tokens ?? promptTokens;
  const estimatedCost = (tokenCount / 1000) * COST_PER_1K_INPUT_TOKENS;

  const sources = activeChunks.map((c, i) => ({
    index: i + 1,
    content: c.content,
  }));

  return { answer, sources, tokenCount, estimatedCost };
}
