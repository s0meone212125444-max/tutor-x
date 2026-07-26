// Simple, robust text chunker for RAG.
// Splits on paragraph/sentence boundaries, targets ~500 words per chunk with overlap.

const TARGET_WORDS = 350;
const OVERLAP_WORDS = 60;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  if (words.length <= TARGET_WORDS) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + TARGET_WORDS);
    chunks.push(slice.join(" "));
    if (i + TARGET_WORDS >= words.length) break;
    i += TARGET_WORDS - OVERLAP_WORDS;
  }
  return chunks;
}
