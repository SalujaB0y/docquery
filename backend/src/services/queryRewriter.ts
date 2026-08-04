import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ConversationTurn = { question: string; answer: string };

// bounds how much history feeds both the rewrite and the generation prompt — a long
// follow-up chain shouldn't make every subsequent question progressively more expensive
export const MAX_HISTORY_TURNS = 6;

// retrieval embeds the question in isolation, so a follow-up like "why does that happen?"
// has almost nothing for the embedding to match against. resolving pronouns and implicit
// references against prior turns before retrieval is what makes a follow-up chain work.
export async function rewriteStandaloneQuestion(
  question: string,
  history: ConversationTurn[]
): Promise<string> {
  if (history.length === 0) return question;

  const conversation = history
    .map(turn => `Q: ${turn.question}\nA: ${turn.answer}`)
    .join('\n\n');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Conversation so far:\n${conversation}\n\nFollow-up question: ${question}\n\nRewrite the follow-up as a standalone question that makes sense without the conversation above, resolving any pronouns or implicit references. If it's already standalone, return it unchanged. Respond with only the rewritten question, nothing else.`,
        },
      ],
      temperature: 0,
    });

    return response.choices[0].message.content?.trim() || question;
  } catch {
    // retrieval on the original phrasing is still better than failing the query outright
    return question;
  }
}
