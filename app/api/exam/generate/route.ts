// Generate a mock exam. Pulls RAG context + past-question style from the course
// if a courseId is given, else generates from the topic alone.
import Groq from "groq-sdk";
import { EXAM_GEN_SYSTEM, buildExamGenUser } from "@/app/lib/examPrompt";
import { embed } from "@/app/lib/embed";
import { supabaseAdmin } from "@/app/lib/supabase";
import { getFormat } from "@/app/lib/examFormats";

export const runtime = "nodejs";
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { topic, count, courseId, format: formatId } = await req.json();
  if (!topic) return json({ error: "Missing topic" }, 400);

  const format = getFormat(formatId);
  const qCount = count || format.defaultCount;

  let context = "";
  let pastQuestions = "";
  if (courseId) {
    try {
      const db = supabaseAdmin();
      const qEmb = await embed(topic);
      const { data } = await db.rpc("match_chunks", {
        query_embedding: qEmb,
        match_course_id: courseId,
        match_count: 6,
      });
      if (data?.length) context = data.map((d: { content: string }) => d.content).join("\n\n");

      // Grab any past-question docs' chunks for style
      const { data: pq } = await db
        .from("chunks")
        .select("content, documents!inner(kind)")
        .eq("course_id", courseId)
        .eq("documents.kind", "past_questions")
        .limit(4);
      if (pq?.length) pastQuestions = pq.map((r: { content: string }) => r.content).join("\n\n");
    } catch {
      /* fall back to topic-only generation */
    }
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${EXAM_GEN_SYSTEM}\n\n${format.promptGuidance}` },
        { role: "user", content: buildExamGenUser({ topic, count: qCount, context, pastQuestions }) },
      ],
    });
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    return json(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return json({ error: msg }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
