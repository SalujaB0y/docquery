const MIN_CHARS = 100;
const MAX_DUPLICATE_LINE_RATIO = 0.4;

export function isUsableChunk(chunk: string): boolean {
  if (chunk.length < MIN_CHARS) return false;

  const lines = chunk.split('\n').filter(Boolean);
  if (lines.length > 1) {
    const unique = new Set(lines).size;
    const duplicateRatio = 1 - unique / lines.length;
    if (duplicateRatio > MAX_DUPLICATE_LINE_RATIO) return false;
  }

  return true;
}
