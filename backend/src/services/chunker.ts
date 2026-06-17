const CHUNK_SIZE = 500;
const OVERLAP = 50;

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function chunkText(text: string): string[] {
  const tokens = tokenize(text);
  const chunks: string[] = [];

  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length);
    chunks.push(tokens.slice(start, end).join(' '));
    if (end === tokens.length) break;
    start += CHUNK_SIZE - OVERLAP;
  }

  return chunks;
}
