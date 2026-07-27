// Ingestion pipeline: PDF (or pasted text) -> extract -> chunk -> embed -> store in pgvector.
// Accepts multipart form: file (PDF) OR text, plus courseId, userId, title, kind.
import { extractText, getDocumentProxy } from "unpdf";
import { chunkText } from "@/app/lib/chunk";
import { embedMany } from "@/app/lib/embed";
import { supabaseAdmin } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  // Track which stage we're in so a failure tells us WHERE it broke (extract vs
  // embed vs store) instead of a vague "ingestion failed".
  let stage = "read form";
  try {
    const form = await req.formData();
    const courseId = form.get("courseId") as string;
    const userId = form.get("userId") as string;
    const title = (form.get("title") as string) || "Untitled";
    const kind = (form.get("kind") as string) || "material";
    const file = form.get("file") as File | null;
    const pastedText = form.get("text") as string | null;

    if (!courseId || !userId) {
      return json({ error: "Missing courseId or userId" }, 400);
    }

    // 1. Get raw text
    stage = "extract text";
    let rawText = "";
    if (file) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      rawText = text;
    } else if (pastedText) {
      rawText = pastedText;
    } else {
      return json({ error: "No file or text provided" }, 400);
    }

    if (!rawText.trim()) {
      return json({ error: "Could not extract any text (is the PDF scanned/image-only?)" }, 422);
    }

    // 2. Chunk
    stage = "chunk";
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return json({ error: "No chunks produced" }, 422);

    // 3. Store document row
    stage = "store document";
    const db = supabaseAdmin();
    const { data: doc, error: docErr } = await db
      .from("documents")
      .insert({ course_id: courseId, user_id: userId, title, kind })
      .select("id")
      .single();
    if (docErr) throw new Error(docErr.message);

    // 4. Embed (Gemini) + store chunks
    stage = "embed";
    const embeddings = await embedMany(chunks);

    stage = "store chunks";
    const rows = chunks.map((content, idx) => ({
      document_id: doc.id,
      course_id: courseId,
      user_id: userId,
      content,
      embedding: embeddings[idx],
      chunk_index: idx,
    }));
    const { error: chunkErr } = await db.from("chunks").insert(rows);
    if (chunkErr) throw new Error(chunkErr.message);

    return json({ ok: true, documentId: doc.id, chunks: chunks.length });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : "unknown error";
    // e.g. "Failed at embed: GEMINI_API_KEY is not set" — surfaced to the UI.
    return json({ error: `Failed at ${stage}: ${detail}` }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
