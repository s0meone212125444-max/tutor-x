// Exam-readiness summary for a student (optionally per course). Reads the
// persisted topic_mastery + recent exam_results and returns an overall
// readiness score, a predicted band, and the weakest topics to fix next.
//
// This is the payoff of persisting mastery: NotebookLM can't tell you "you'll
// likely score X, fix these 3 topics" because it doesn't track your exam
// performance over time. TutorX does.
import { supabaseAdmin } from "@/app/lib/supabase";
import { decayedMastery, readinessPct, slip } from "@/app/lib/decay";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId, courseId } = await req.json() as {
    userId?: string | null;
    courseId?: string | null;
  };
  if (!userId) return json({ ready: null });

  try {
    const db = supabaseAdmin();
    const now = Date.now();

    // Pull mastery rows (optionally scoped to a course). last_reviewed drives decay.
    let mq = db
      .from("topic_mastery")
      .select("topic, mastery, times_seen, last_reviewed, last_seen")
      .eq("user_id", userId);
    if (courseId) mq = mq.eq("course_id", courseId);
    const { data: mastery } = await mq;

    // No history yet — the caller shows an encouraging "take a mock" nudge.
    if (!mastery || mastery.length === 0) return json({ ready: null });

    const rows = mastery as Array<{
      topic: string; mastery: number; times_seen: number;
      last_reviewed?: string | null; last_seen?: string | null;
    }>;

    // DECAYED readiness — the live number, discounted for time idle.
    const readiness = readinessPct(rows, now) ?? 0;

    // How much has slipped since everything was fresh — powers "↓ from X%".
    const freshPct = Math.round(
      (rows.reduce((s, r) => s + Number(r.mastery), 0) / rows.length) * 100
    );
    const slipped = Math.max(0, freshPct - readiness);

    // Weakest topics first, using the DECAYED value (what's actually shaky now).
    const weakest = rows
      .map((r) => ({
        topic: r.topic,
        decayed: decayedMastery(Number(r.mastery), r.last_reviewed ?? r.last_seen, now),
        drop: slip(Number(r.mastery), r.last_reviewed ?? r.last_seen, now),
      }))
      .filter((r) => r.decayed < 0.7)
      .sort((a, b) => a.decayed - b.decayed)
      .slice(0, 3)
      .map((r) => ({
        topic: r.topic,
        mastery: Math.round(r.decayed * 100),
        slipping: r.drop >= 0.08, // flag topics that have meaningfully slipped
      }));

    // Count of exams taken (for confidence framing).
    let eq = db
      .from("exam_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (courseId) eq = eq.eq("course_id", courseId);
    const { count: examCount } = await eq;

    // How many topics are DUE for review right now — the daily-return badge.
    let dq = db
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("due_at", new Date().toISOString());
    if (courseId) dq = dq.eq("course_id", courseId);
    const { count: dueCount } = await dq;

    return json({
      ready: {
        readiness,
        slipped,          // points lost to decay since last active
        band: bandFor(readiness),
        topicsTracked: rows.length,
        examsTaken: examCount ?? 0,
        dueToday: dueCount ?? 0,
        weakest,
      },
    });
  } catch {
    return json({ ready: null });
  }
}

// A friendly readiness band + JAMB-style score projection (400-scale) so the
// number feels like it maps to the real exam the student cares about.
function bandFor(readiness: number): { label: string; jambBand: string; tone: string } {
  if (readiness >= 85) return { label: "Exam-ready", jambBand: "300+", tone: "great" };
  if (readiness >= 70) return { label: "Almost there", jambBand: "260–300", tone: "good" };
  if (readiness >= 50) return { label: "Getting there", jambBand: "200–260", tone: "mid" };
  return { label: "Needs work", jambBand: "under 200", tone: "low" };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
