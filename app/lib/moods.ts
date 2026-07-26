// The tutor's EMOTIONS. A small, fixed vocabulary shared by chat + lecture so the
// student SEES the tutor react — fired up when they're getting it, patient when
// they're lost, tough-love when they keep raising their hand with nothing to ask.
// This reactive personality is the thing worth screenshotting.

export type MoodKey =
  | "teaching"
  | "fired_up"
  | "proud"
  | "serious"
  | "patient"
  | "playful"
  | "tough_love";

export const DEFAULT_MOOD: MoodKey = "teaching";

export const MOODS: Record<MoodKey, { face: string; label: string; color: string }> = {
  teaching:   { face: "🙂", label: "teaching",      color: "#2f80ed" },
  fired_up:   { face: "🔥", label: "let's go",      color: "#e8590c" },
  proud:      { face: "😄", label: "you nailed it", color: "#2b8a3e" },
  serious:    { face: "🤨", label: "lock in",       color: "#495057" },
  patient:    { face: "😌", label: "take your time", color: "#1098ad" },
  playful:    { face: "😏", label: "cheeky",        color: "#9c36b5" },
  tough_love: { face: "😤", label: "amping up",     color: "#e03131" },
};

export function isMoodKey(x: string): x is MoodKey {
  return Object.prototype.hasOwnProperty.call(MOODS, x);
}

// Pull a leading [[mood:KEY]] tag off a string. Tolerant of streaming input:
// while the tag is still arriving (e.g. "[[mo") we DON'T show the partial tag as
// text, we just hold the default mood until it completes. Unknown/missing tag →
// default mood, full text passed through.
export function parseMoodTag(text: string): { mood: MoodKey; rest: string } {
  const full = /^\s*\[\[mood:([a-z_]+)\]\]\s*/i;
  const m = text.match(full);
  if (m) {
    const key = m[1].toLowerCase();
    return { mood: isMoodKey(key) ? key : DEFAULT_MOOD, rest: text.slice(m[0].length) };
  }
  // Tag may still be streaming in — if what we have so far is a prefix of the
  // tag pattern, hide it until it resolves rather than flashing "[[mood".
  const partial = /^\s*\[\[?m?o?o?d?:?[a-z_]*$/i;
  if (partial.test(text)) return { mood: DEFAULT_MOOD, rest: "" };
  return { mood: DEFAULT_MOOD, rest: text };
}

// The list of mood keys, for embedding in prompts so the model knows its palette.
export const MOOD_KEYS = Object.keys(MOODS) as MoodKey[];
