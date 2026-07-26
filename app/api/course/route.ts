// Course dashboard data — everything the "Course = Project" home screen needs
// in one call: uploaded materials, the mastery map, past exam attempts, and a
// readiness roll-up. This is the persistent workspace that makes TutorX feel
// like it KNOWS the student for this course (the Projects insight).
import { supabaseAdmin } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId, courseId } = (await req.json()) as {
    userId?: string | null;
    courseId?: string | null;
  };
  if (!userId || !courseId) return json({ error: "Missing userId or courseId" }, 400);

  try {
    const db = supabaseAdmin();

    // Run the independent reads together.
    const [courseRes, docsRes, masteryRes, examsRes, lessonsRes] = await Promise.all([
      db.from("courses").select("teaching_prefs").eq("id", courseId).eq("user_id", userId).single(),
      db
        .from("documents")
        .select("id, title, kind, created_at")
        .eq("course_id", courseId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      db
        .from("topic_mastery")
        .select("topic, mastery, times_seen, last_seen")
        .eq("course_id", courseId)
        .eq("user_id", userId)
        .order("mastery", { ascending: true }),
      db
        .from("exam_results")
        .select("id, score, total_questions, weak_topics, created_at")
        .eq("course_id", courseId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("lessons")
        .select("id, topic, objective, created_at")
        .eq("course_id", courseId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const documents = (docsRes.data || []) as Array<{
      id: string; title: string; kind: string; created_at: string;
    }>;
    const mastery = (masteryRes.data || []) as Array<{
      topic: string; mastery: number; times_seen: number; last_seen: string;
    }>;
    const exams = (examsRes.data || []) as Array<{
      id: string; score: number; total_questions: number; weak_topics: string[]; created_at: string;
    }>;
    const lessons = (lessonsRes.data || []) as Array<{
      id: string; topic: string; objective: string | null; created_at: string;
    }>;
    const teachingPrefs = (courseRes.data as { teaching_prefs?: string | null } | null)?.teaching_prefs || "";

    // Readiness roll-up from the mastery map.
    let readiness: number | null = null;
    let band: string | null = null;
    if (mastery.length > 0) {
      const avg = mastery.reduce((s, m) => s + Number(m.mastery), 0) / mastery.length;
      readiness = Math.round(avg * 100);
      band = readiness >= 85 ? "Exam-ready"
        : readiness >= 70 ? "Almost there"
        : readiness >= 50 ? "Getting there"
        : "Needs work";
    }

    const materialsCount = documents.filter((d) => d.kind !== "past_questions").length;
    const pastQCount = documents.filter((d) => d.kind === "past_questions").length;

    // "What your tutor remembers" — auto-derived from the teach->test loop, NOT
    // hand-typed. This is the edge over Claude/ChatGPT Projects, whose memory is
    // a passive folder of files + instructions: ours grows as the student works.
    const remembers: string[] = [];
    const weak = mastery.filter((m) => Number(m.mastery) < 0.5).slice(0, 3).map((m) => m.topic);
    const strong = mastery.filter((m) => Number(m.mastery) >= 0.8).slice(0, 3).map((m) => m.topic);
    if (weak.length) remembers.push(`You struggle most with ${weak.join(", ")} — I teach these slower and test them more.`);
    if (strong.length) remembers.push(`You've got ${strong.join(", ")} down — I won't waste your time re-teaching them.`);
    if (exams.length) {
      const last = exams[0];
      remembers.push(`Your last mock: ${Math.round(Number(last.score))}% across ${exams.length} attempt${exams.length > 1 ? "s" : ""}.`);
    }
    if (lessons.length) remembers.push(`We've covered ${lessons.length} lesson${lessons.length > 1 ? "s" : ""} together — you can reopen any of them.`);
    if (materialsCount || pastQCount) remembers.push(`I teach from your ${materialsCount} note${materialsCount === 1 ? "" : "s"}${pastQCount ? ` and ${pastQCount} past-question set${pastQCount === 1 ? "" : "s"}` : ""}, not a generic textbook.`);

    return json({
      documents,
      materialsCount,
      pastQCount,
      mastery: mastery.map((m) => ({
        topic: m.topic,
        mastery: Math.round(Number(m.mastery) * 100),
        timesSeen: m.times_seen,
      })),
      exams: exams.map((e) => ({
        id: e.id,
        score: Math.round(Number(e.score)),
        totalQuestions: e.total_questions,
        weakTopics: e.weak_topics || [],
        createdAt: e.created_at,
      })),
      lessons: lessons.map((l) => ({
        id: l.id,
        topic: l.topic,
        objective: l.objective || l.topic,
        createdAt: l.created_at,
      })),
      teachingPrefs,
      remembers,
      readiness,
      band,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load course";
    return json({ error: msg }, 500);
  }
}

// Save this course's standing teaching instructions (Projects "custom
// instructions", scoped to a course). RLS-safe via user_id match.
export async function PATCH(req: Request) {
  const { userId, courseId, teachingPrefs } = (await req.json()) as {
    userId?: string; courseId?: string; teachingPrefs?: string;
  };
  if (!userId || !courseId) return json({ error: "Missing userId or courseId" }, 400);
  try {
    const { error } = await supabaseAdmin()
      .from("courses")
      .update({ teaching_prefs: (teachingPrefs || "").slice(0, 1000) })
      .eq("id", courseId)
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save instructions";
    return json({ error: msg }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
