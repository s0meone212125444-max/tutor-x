// Hosted embeddings via Google Gemini `text-embedding-004` (768-dim).
//
// WHY HOSTED (not local transformers.js): the previous local model shipped a
// ~90MB+ ONNX runtime that blows past Vercel serverless limits (250MB unzipped,
// cold-start memory/time) — so uploads silently failed in production and the tutor
// fell back to generic teaching that ignored the student's notes. A REST call has
// none of that weight and runs anywhere.
//
// Free tier: ~1500 req/day. Key from https://aistudio.google.com/app/apikey ->
// set GEMINI_API_KEY in the environment (Vercel + local .env.local).

// Verified against the live API: `text-embedding-004` is retired (404s), the
// current model is `gemini-embedding-001`. It defaults to 3072 dims but honours
// outputDimensionality, so we ask for 768 to match the `vector(768)` DB column.
const MODEL = "gemini-embedding-001";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Embedding dimensionality we request — MUST match the DB `vector(N)` column. */
export const EMBED_DIM = 768;

function key(): string {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it in Vercel env (and local .env.local). " +
        "Get a free key at https://aistudio.google.com/app/apikey"
    );
  }
  // Env values pasted through dashboards often arrive with wrapping quotes, stray
  // whitespace or a trailing newline — Google then rejects them as invalid creds
  // (401 UNAUTHENTICATED), which looks like a "bad key" but is really a bad paste.
  const k = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!k) throw new Error("GEMINI_API_KEY is set but empty after trimming quotes/whitespace.");
  return k;
}

/** Non-secret fingerprint of the configured key, for debugging env problems. */
export function keyFingerprint(): string {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return "GEMINI_API_KEY: MISSING";
  const k = raw.trim().replace(/^["']|["']$/g, "").trim();
  const dirty = raw !== k ? " (had quotes/whitespace — cleaned)" : "";
  return `GEMINI_API_KEY: len=${k.length} starts=${k.slice(0, 5)} ends=${k.slice(-4)}${dirty}`;
}

// Embed a single string -> number[768]
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${BASE}/${MODEL}:embedContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIM,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embed failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values?.length) throw new Error("Gemini embed returned no vector");
  return values;
}

// Embed many strings. Uses the batch endpoint (one round-trip per batch of 100)
// so ingesting a document is fast and stays under rate limits.
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const out: number[][] = [];
  const BATCH = 100; // Gemini batchEmbedContents caps at 100 requests per call
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await fetch(`${BASE}/${MODEL}:batchEmbedContents?key=${key()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: slice.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBED_DIM,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini batch embed failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
    const embs = json.embeddings;
    if (!embs?.length || embs.length !== slice.length) {
      throw new Error(`Gemini batch embed returned ${embs?.length ?? 0}/${slice.length} vectors`);
    }
    for (const e of embs) {
      if (!e.values?.length) throw new Error("Gemini batch embed had an empty vector");
      out.push(e.values);
    }
  }
  return out;
}
