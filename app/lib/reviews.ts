// Spaced-repetition queue — the DAILY RETURN reason.
//
// Every topic a student learns or is tested on becomes a review that comes DUE
// on a schedule. The home screen shows "N topics due today", so opening TutorX
// has a concrete job every day — the Anki/Duolingo habit loop, aimed at passing
// the exam. Get a topic right and its next review pushes further out; get it
// wrong and it comes back tomorrow.
//
// Scheduling is a trimmed SM-2: enough to feel smart, ~20 lines, no library.
import { supabaseAdmin } from "./supabase";

/// Given the prior SR state and how well the student just did (0..1), compute the
/// next interval. quality >= 0.6 counts as a "pass".
export function schedule(
  prev: { interval_days: number; ease: number; reps: number },
  quality: number
): { interval_days: number; ease: number; reps: number; due_at: string } {
  const passed = quality >= 0.6;
  let { ease, reps } = prev;
  let interval: number;

  if (!passed) {
    // Lapsed — see it again tomorrow, nudge ease down (min 1.3).
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
    interval = 1;
  } else {
    reps = reps + 1;
    // Ease drifts with performance: a strong pass raises it, a weak pass lowers.
    ease = Math.max(1.3, ease + (0.1 - (1 - quality) * 0.8 * (0.08 + 0.02)));
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round((prev.interval_days || 3) * ease);
    interval = Math.min(interval, 120); // cap: an exam is a semester away, not years
  }

  const due = new Date(Date.now() + interval * 86_400_000).toISOString();
  return { interval_days: interval, ease: Number(ease.toFixed(2)), reps, due_at: due };
}

/// After a marked exam, upsert a review per topic so it enters/advances in the
/// queue. Best-effort — never throws into the request path.
export async function scheduleReviews(opts: {
  userId?: string | null;
  courseId?: string | null;
  perTopicQuality: Record<string, number>; // topic -> 0..1 this session
}): Promise<void> {
  const { userId, courseId, perTopicQuality } = opts;
  if (!userId) return;
  const topics = Object.keys(perTopicQuality);
  if (!topics.length) return;

  const db = supabaseAdmin();
  let existing: Record<string, { interval_days: number; ease: number; reps: number }> = {};
  try {
    const { data } = await db
      .from("reviews")
      .select("topic, interval_days, ease, reps")
      .eq("user_id", userId)
      .in("topic", topics);
    if (data) {
      existing = Object.fromEntries(
        data.map((d: { topic: string; interval_days: number; ease: number; reps: number }) => [
          d.topic,
          { interval_days: Number(d.interval_days), ease: Number(d.ease), reps: d.reps },
        ])
      );
    }
  } catch {
    /* treat as fresh */
  }

  const now = new Date().toISOString();
  const rows = topics.map((topic) => {
    const prev = existing[topic] ?? { interval_days: 0, ease: 2.5, reps: 0 };
    const s = schedule(prev, perTopicQuality[topic]);
    return {
      user_id: userId,
      course_id: courseId || null,
      topic,
      interval_days: s.interval_days,
      ease: s.ease,
      reps: s.reps,
      last_result: Number(perTopicQuality[topic].toFixed(3)),
      due_at: s.due_at,
      last_reviewed: now,
    };
  });

  try {
    await db.from("reviews").upsert(rows, { onConflict: "user_id,course_id,topic" });
  } catch {
    /* non-fatal */
  }
}

/// The daily queue: topics due now (due_at <= now), soonest first. Powers the
/// home "N topics due today" badge and the review session.
export async function dueReviews(opts: {
  userId?: string | null;
  courseId?: string | null;
  limit?: number;
}): Promise<Array<{ topic: string; dueAt: string; reps: number }>> {
  const { userId, courseId, limit = 20 } = opts;
  if (!userId) return [];
  try {
    const db = supabaseAdmin();
    let q = db
      .from("reviews")
      .select("topic, due_at, reps")
      .eq("user_id", userId)
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(limit);
    if (courseId) q = q.eq("course_id", courseId);
    const { data } = await q;
    return (data || []).map((d: { topic: string; due_at: string; reps: number }) => ({
      topic: d.topic,
      dueAt: d.due_at,
      reps: d.reps,
    }));
  } catch {
    return [];
  }
}
