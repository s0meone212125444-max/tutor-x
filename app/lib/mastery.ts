// Mastery persistence — the heart of TutorX's moat over NotebookLM.
//
// NotebookLM can answer questions about your docs, but it has NO memory of what
// you're weak at and NO loop that re-teaches your gaps. TutorX does: every
// marked exam updates a per-topic mastery score that survives across sessions,
// so the tutor can say "you keep missing L'Hôpital — let's fix that today."
//
// Mastery is a simple EWMA (exponentially-weighted moving average) of your
// per-topic exam performance in [0,1]. No exotic ML — ~1 SQL upsert per topic.
import { supabaseAdmin } from "./supabase";
import { scheduleReviews } from "./reviews";

/// How heavily the newest result weighs vs history. 0.5 = the latest exam and
/// all prior history count equally; higher = more reactive to recent results.
const ALPHA = 0.5;

export type ExamPersistResult = {
  id: number;
  topic: string;
  awarded: number;
  outOf: number;
  correct: boolean;
  feedback: string;
};

/// Persist a marked exam and roll each topic's mastery forward. Best-effort:
/// never throws into the request path (marking already succeeded).
export async function persistExam(opts: {
  userId?: string | null;
  courseId?: string | null;
  score: number;
  totalQuestions: number;
  weakTopics: string[];
  results: ExamPersistResult[];
}): Promise<void> {
  const { userId, courseId, score, totalQuestions, weakTopics, results } = opts;
  if (!userId) return; // anonymous / not signed in — nothing to persist

  const db = supabaseAdmin();

  // 1. Save the exam result row (full breakdown in jsonb for later review).
  try {
    await db.from("exam_results").insert({
      user_id: userId,
      course_id: courseId || null,
      score,
      total_questions: totalQuestions,
      weak_topics: weakTopics,
      detail: results,
    });
  } catch {
    /* non-fatal */
  }

  // 2. Roll topic mastery forward. Aggregate this exam's marks per topic first.
  const perTopic: Record<string, { got: number; max: number }> = {};
  for (const r of results) {
    if (!r.topic) continue;
    perTopic[r.topic] ??= { got: 0, max: 0 };
    perTopic[r.topic].got += r.awarded;
    perTopic[r.topic].max += r.outOf;
  }

  const topics = Object.keys(perTopic);
  if (topics.length === 0) return;

  // Fetch existing mastery for these topics in one query.
  let existing: Record<string, { mastery: number; times_seen: number }> = {};
  try {
    const { data } = await db
      .from("topic_mastery")
      .select("topic, mastery, times_seen")
      .eq("user_id", userId)
      .in("topic", topics);
    if (data) {
      existing = Object.fromEntries(
        data.map((d: { topic: string; mastery: number; times_seen: number }) => [
          d.topic,
          { mastery: Number(d.mastery), times_seen: d.times_seen },
        ])
      );
    }
  } catch {
    /* treat as no history */
  }

  const now = new Date().toISOString();
  const rows = topics.map((topic) => {
    const { got, max } = perTopic[topic];
    const thisScore = max > 0 ? got / max : 0;
    const prior = existing[topic];
    const mastery = prior
      ? ALPHA * thisScore + (1 - ALPHA) * prior.mastery
      : thisScore; // first time we see this topic: seed with the raw score
    return {
      user_id: userId,
      course_id: courseId || null,
      topic,
      mastery: Number(mastery.toFixed(3)),
      times_seen: (prior?.times_seen ?? 0) + 1,
      last_seen: now,
      // Practising a topic resets its decay clock — readiness climbs back up.
      last_reviewed: now,
    };
  });

  try {
    // Upsert on the (user_id, course_id, topic) unique constraint.
    await db.from("topic_mastery").upsert(rows, {
      onConflict: "user_id,course_id,topic",
    });
  } catch {
    /* non-fatal */
  }

  // Seed / advance the spaced-repetition queue so these topics come due again —
  // the daily-return hook. quality = this session's raw per-topic score.
  const perTopicQuality: Record<string, number> = {};
  for (const topic of topics) {
    const { got, max } = perTopic[topic];
    perTopicQuality[topic] = max > 0 ? got / max : 0;
  }
  await scheduleReviews({ userId, courseId, perTopicQuality });
}

/// Read a course's weakest topics (lowest mastery first) for surfacing on the
/// home screen and for adaptive re-teaching. Returns [] on any failure.
export async function weakestTopics(opts: {
  userId?: string | null;
  courseId?: string | null;
  limit?: number;
  threshold?: number;
}): Promise<Array<{ topic: string; mastery: number; timesSeen: number }>> {
  const { userId, courseId, limit = 5, threshold = 0.7 } = opts;
  if (!userId) return [];
  try {
    const db = supabaseAdmin();
    let q = db
      .from("topic_mastery")
      .select("topic, mastery, times_seen")
      .eq("user_id", userId)
      .lt("mastery", threshold)
      .order("mastery", { ascending: true })
      .limit(limit);
    if (courseId) q = q.eq("course_id", courseId);
    const { data } = await q;
    return (data || []).map(
      (d: { topic: string; mastery: number; times_seen: number }) => ({
        topic: d.topic,
        mastery: Number(d.mastery),
        timesSeen: d.times_seen,
      })
    );
  } catch {
    return [];
  }
}
