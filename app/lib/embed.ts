// Free, local embeddings via transformers.js — no API key, no external cost.
// Model: gte-small (384-dim). Loaded once and cached in the server process.
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Supabase/gte-small");
  }
  return extractor;
}

// Embed a single string -> number[384]
export async function embed(text: string): Promise<number[]> {
  const ex = await getExtractor();
  const output = await ex(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// Embed many strings sequentially (keeps memory low on free hosting)
export async function embedMany(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embed(t));
  }
  return out;
}
