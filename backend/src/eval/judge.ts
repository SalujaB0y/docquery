import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type Judgement = {
  supported: boolean;
  unsupportedClaims: string[];
};

function buildJudgePrompt(
  question: string,
  answer: string,
  sources: { index: number; content: string }[]
): string {
  const excerpts = sources.map(s => `[${s.index}] ${s.content}`).join('\n\n');

  return `You are grading whether an answer is faithful to the source excerpts it was given.

An answer is faithful if every factual claim it makes is directly supported by the excerpts.
Judge only support, not correctness in the wider world: a claim that is true in reality but
absent from the excerpts is UNSUPPORTED. Ignore citation markers like [1], hedging, and
statements that the excerpts do not cover something — those are not claims.

Excerpts:
${excerpts}

Question: ${question}

Answer:
${answer}

Reply with JSON only, no code fence:
{"supported": true or false, "unsupported_claims": ["claim in a few words", ...]}
If every claim is supported, use an empty array.`;
}

export async function judgeFaithfulness(
  question: string,
  answer: string,
  sources: { index: number; content: string }[]
): Promise<Judgement> {
  // the runner filters refusals out before judging, so an answer arriving here with no
  // excerpts behind it is one that made claims on an empty context — nothing supports it
  if (sources.length === 0) {
    return { supported: false, unsupportedClaims: ['answered with no retrieved context'] };
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: buildJudgePrompt(question, answer, sources) }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content ?? '{}';

  try {
    const parsed = JSON.parse(raw) as {
      supported?: boolean;
      unsupported_claims?: string[];
    };
    return {
      supported: parsed.supported === true,
      unsupportedClaims: parsed.unsupported_claims ?? [],
    };
  } catch {
    // a judge we can't parse is not evidence of faithfulness, so count it as a miss
    return { supported: false, unsupportedClaims: ['judge returned unparseable output'] };
  }
}
