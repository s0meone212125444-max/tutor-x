// The student's profile — who they are and what they're aiming for. Captured once
// at onboarding, then fed into the tutor's prompts so it teaches a REAL person with
// real goals and a real deadline, not a stranger.
import { supabaseBrowser } from "./supabase";

export type StudentProfile = {
  school?: string;
  program?: string;
  level?: string;
  exam_period?: string;
  overall_goal?: string;
  personality_id?: string; // the "senior" they chose to be taught by
};

// Load the current user's profile, or null if they haven't onboarded yet.
export async function loadProfile(): Promise<StudentProfile | null> {
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("student_profiles")
    .select("school, program, level, exam_period, overall_goal, personality_id")
    .maybeSingle();
  return data ?? null;
}

// Create/update the profile (one row per user, keyed on user_id).
export async function saveProfile(userId: string, p: StudentProfile) {
  const sb = supabaseBrowser();
  return sb.from("student_profiles").upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() });
}

// A profile counts as "complete enough" to skip onboarding once we know their
// school and program — the two anchors the tutor needs most.
export function isOnboarded(p: StudentProfile | null): boolean {
  return !!(p && p.school?.trim() && p.program?.trim());
}

// Compact one-paragraph summary of the learner for injecting into a system prompt.
// Kept short on purpose — it primes the tutor without bloating the context.
export function learnerSummary(p: StudentProfile | null, courseGoal?: { name?: string; goal?: string; target?: string; teaching_prefs?: string | null }): string {
  if (!p && !courseGoal?.goal && !courseGoal?.teaching_prefs?.trim()) return "";
  const bits: string[] = [];
  if (p?.program) bits.push(`studying ${p.program}`);
  if (p?.level) bits.push(`${p.level}`);
  if (p?.school) bits.push(`at ${p.school}`);
  const who = bits.length ? `The student is ${bits.join(", ")}.` : "";
  const when = p?.exam_period ? ` Their exams: ${p.exam_period}.` : "";
  const big = p?.overall_goal ? ` Their overall goal: "${p.overall_goal}".` : "";
  let course = "";
  if (courseGoal?.goal) {
    course = ` For this course${courseGoal.name ? ` (${courseGoal.name})` : ""} they want: "${courseGoal.goal}"${courseGoal.target ? ` — target: ${courseGoal.target}` : ""}.`;
  }
  // Per-course teaching instructions — the student's own standing rules for this
  // subject (the Projects "custom instructions" idea, scoped to a course).
  const prefs = courseGoal?.teaching_prefs?.trim()
    ? ` STANDING INSTRUCTIONS for this course (always honor): "${courseGoal.teaching_prefs.trim()}".`
    : "";
  const summary = `${who}${when}${big}${course}${prefs}`.trim();
  return summary ? `WHO YOU'RE TEACHING: ${summary} Teach with their goal and deadline in mind — connect what you teach to what they need to achieve.` : "";
}
