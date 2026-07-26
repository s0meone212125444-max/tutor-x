// Readiness DECAY — the engine that creates the daily itch.
//
// Mastery you earned last week is not mastery you have today. A topic you haven't
// reviewed slowly slips, so your Exam-Readiness % falls when you're idle. That
// visible drop is the loss-aversion hook that pulls students back — and the ONLY
// way to push it back up is to practise in the app. Utility -> habit.
//
// Pure functions, no I/O — callers pass in the stored mastery + timestamp.

/// Half-life in days: how long until an un-reviewed topic loses HALF its mastery.
/// 10 days is tuned for a semester rhythm — miss a few days and you feel it, but
/// it's not punishing enough to feel unfair.
const HALF_LIFE_DAYS = 10;

/// A floor so a topic never decays to literally zero — you don't fully forget
/// something you once knew, and zeroing it out would feel demoralising.
const DECAY_FLOOR = 0.15;

/// Decay a stored mastery value given how long since it was last reviewed.
/// mastery' = floor + (mastery - floor) * 0.5^(daysSince / halfLife)
export function decayedMastery(
  mastery: number,
  lastReviewedISO: string | null | undefined,
  nowMs: number
): number {
  if (!lastReviewedISO) return mastery;
  const last = Date.parse(lastReviewedISO);
  if (Number.isNaN(last)) return mastery;
  const days = Math.max(0, (nowMs - last) / 86_400_000);
  if (days <= 0) return mastery;
  const factor = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const decayed = DECAY_FLOOR + (mastery - DECAY_FLOOR) * factor;
  // Never report ABOVE the stored value; clamp to [0,1].
  return Math.max(0, Math.min(mastery, decayed));
}

/// Overall readiness for a set of topics: the mean decayed mastery, 0..100.
/// With no topics yet, readiness is null (the UI shows "take a diagnostic").
export function readinessPct(
  topics: Array<{ mastery: number; last_reviewed?: string | null; last_seen?: string | null }>,
  nowMs: number
): number | null {
  if (!topics.length) return null;
  const sum = topics.reduce((acc, t) => {
    const stamp = t.last_reviewed ?? t.last_seen ?? null;
    return acc + decayedMastery(Number(t.mastery) || 0, stamp, nowMs);
  }, 0);
  return Math.round((sum / topics.length) * 100);
}

/// How much a topic has slipped since it was last reviewed, in mastery points
/// (0..1). Used to phrase "slipping on X" nudges — only surface topics that have
/// actually dropped a meaningful amount.
export function slip(
  mastery: number,
  lastReviewedISO: string | null | undefined,
  nowMs: number
): number {
  return Math.max(0, (Number(mastery) || 0) - decayedMastery(mastery, lastReviewedISO, nowMs));
}
