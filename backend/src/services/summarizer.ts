import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// a summary is a browsing aid, not an analysis — the first few thousand characters are
// enough to describe what a document is about, and capping input keeps this cheap even
// for a long transcript
const MAX_INPUT_CHARS = 6000;

export async function summarizeDocument(text: string): Promise<string | null> {
  const excerpt = text.slice(0, MAX_INPUT_CHARS);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Summarize this document in one short sentence, suitable as a file description in a document list. Respond with only the sentence, no preamble.\n\n${excerpt}`,
        },
      ],
      temperature: 0.2,
    });

    return response.choices[0].message.content?.trim() || null;
  } catch {
    // a missing summary shouldn't block ingestion — the document is still usable without one
    return null;
  }
}
