import dotenv from 'dotenv';
dotenv.config();

import pairs from './pairs.json';

const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:3001';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const FALLBACK_PHRASE = "I don't have enough information";

type Pair = {
  question: string;
  expected_chunks_contain: string[];
  answer_should_mention: string[];
  is_fallback?: boolean;
};

type QueryResponse = {
  answer: string;
  sources: { index: number; content: string }[];
};

async function query(question: string, retries = 3): Promise<QueryResponse> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/query?stream=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (res.status === 429) {
        const wait = 15000 * (attempt + 1);
        console.log(`rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) throw new Error(`query failed: ${res.status}`);
      return res.json() as Promise<QueryResponse>;
    } catch (err) {
      if (attempt < retries - 1) {
        const wait = 3000 * (attempt + 1);
        console.log(`request failed (attempt ${attempt + 1}), retrying in ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }

  throw new Error('query failed after retries');
}

function checkRetrievalHit(result: QueryResponse, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const allSourceText = result.sources.map(s => s.content).join(' ').toLowerCase();
  return keywords.some(kw => allSourceText.includes(kw.toLowerCase()));
}

function checkAnswerFaithfulness(answer: string, expectedMentions: string[]): boolean {
  if (expectedMentions.length === 0) return true;
  const lower = answer.toLowerCase();
  return expectedMentions.every(term => lower.includes(term.toLowerCase()));
}

function checkFallback(answer: string): boolean {
  return answer.includes(FALLBACK_PHRASE);
}

async function run() {
  const normalPairs = (pairs as Pair[]).filter(p => !p.is_fallback);
  const fallbackPairs = (pairs as Pair[]).filter(p => p.is_fallback);

  let retrievalHits = 0;
  let faithfulAnswers = 0;
  let fallbackCorrect = 0;

  console.log(`\nrunning eval against ${API_URL}\n`);
  console.log(`${'question'.padEnd(55)} retrieval  faithful`);
  console.log('─'.repeat(75));

  for (const pair of normalPairs) {
    await sleep(5000);
    const result = await query(pair.question);
    const hit = checkRetrievalHit(result, pair.expected_chunks_contain);
    const faithful = checkAnswerFaithfulness(result.answer, pair.answer_should_mention);

    if (hit) retrievalHits++;
    if (faithful) faithfulAnswers++;

    const q = pair.question.slice(0, 53).padEnd(55);
    console.log(`${q} ${hit ? '✓' : '✗'}          ${faithful ? '✓' : '✗'}`);
  }

  console.log('\n' + '─'.repeat(75));
  console.log('fallback pairs\n');

  for (const pair of fallbackPairs) {
    await sleep(5000);
    const result = await query(pair.question);
    const correct = checkFallback(result.answer);
    if (correct) fallbackCorrect++;
    const q = pair.question.slice(0, 53).padEnd(55);
    console.log(`${q} ${correct ? '✓' : '✗'}`);
  }

  const retrievalRate = (retrievalHits / normalPairs.length) * 100;
  const faithfulnessRate = (faithfulAnswers / normalPairs.length) * 100;
  const fallbackRate = fallbackPairs.length > 0
    ? (fallbackCorrect / fallbackPairs.length) * 100
    : 100;

  console.log('\n' + '═'.repeat(75));
  console.log('results\n');
  console.log(`retrieval hit rate:   ${retrievalRate.toFixed(1)}%  (target: >80%)`);
  console.log(`answer faithfulness:  ${faithfulnessRate.toFixed(1)}%  (target: >70%)`);
  console.log(`fallback accuracy:    ${fallbackRate.toFixed(1)}%  (target: 100%)`);
  console.log('');

  if (retrievalRate < 80 || faithfulnessRate < 70) {
    console.error('eval failed: one or more metrics below threshold');
    process.exit(1);
  }

  console.log('eval passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
