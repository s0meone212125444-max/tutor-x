// Generates a full LECTURE PLAN (objective + ordered say/board steps) for a topic,
// grounded in the student's uploaded material via RAG when a course is given.
import Groq from "groq-sdk";
import { LECTURE_SYSTEM, buildLectureUser, withPersonality } from "@/app/lib/lecturePrompt";
import { embed } from "@/app/lib/embed";
import { supabaseAdmin } from "@/app/lib/supabase";

export const runtime = "nodejs";
// Deep lessons are a big generation — give it room before the platform times out.
export const maxDuration = 300;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { topic, courseId, learner, personalityId, userId } = await req.json();
  if (!topic) return json({ error: "Missing topic" }, 400);

  // RAG: ground the lecture in the student's own material.
  let context = "";
  if (courseId) {
    try {
      const qEmb = await embed(topic);
      const db = supabaseAdmin();
      // Pull a WIDE slice of the student's material. A deep, note-grounded lecture
      // needs far more than a few snippets — 8 chunks was why lessons drifted into
      // generic textbook content even when a course was attached.
      const { data } = await db.rpc("match_chunks", {
        query_embedding: qEmb,
        match_course_id: courseId,
        match_count: 20,
      });
      if (data?.length) context = data.map((d: { content: string }) => d.content).join("\n\n---\n\n");
    } catch {
      /* fall back to general knowledge */
    }
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      // Groq free tier caps at 12k tokens/minute for the whole request (prompt +
      // completion), so we can't just ask for more — 8000 leaves room for the
      // system prompt + up to 20 retrieved chunks while still allowing a lesson
      // ~2x deeper than the old 4000-token ceiling.
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: withPersonality(LECTURE_SYSTEM, personalityId) },
        { role: "user", content: buildLectureUser(topic, context, learner) },
      ],
    });
    const plan = JSON.parse(completion.choices[0].message.content || "{}");
    if (!plan.steps?.length) return json({ error: "Could not plan the lecture" }, 422);

    // Persist the lesson so the course can resume it instantly later (no
    // regeneration). Fire-and-forget — a save failure must never break the
    // lesson the student is about to see.
    if (userId) {
      try {
        const id = await supabaseAdmin()
          .from("lessons")
          .insert({
            user_id: userId,
            course_id: courseId || null,
            topic,
            objective: plan.objective || topic,
            steps: plan.steps,
          })
          .select("id")
          .single();
        if (id.data?.id) plan.lessonId = id.data.id;
      } catch {
        /* non-fatal: lesson still returns, just isn't saved */
      }
    }

    return json(plan);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lecture planning failed";
    return json({ error: msg }, 500);
  }
}

// Resume a saved lesson instantly — no model call, no cost. Returns the stored
// plan so tapping a past lesson reopens exactly what the student saw before.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");
  const userId = url.searchParams.get("userId");
  if (!lessonId || !userId) return json({ error: "Missing lessonId or userId" }, 400);
  try {
    const { data, error } = await supabaseAdmin()
      .from("lessons")
      .select("id, topic, objective, steps")
      .eq("id", lessonId)
      .eq("user_id", userId)
      .single();
    if (error || !data) return json({ error: "Lesson not found" }, 404);
    return json({ objective: data.objective || data.topic, steps: data.steps, lessonId: data.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load lesson";
    return json({ error: msg }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
