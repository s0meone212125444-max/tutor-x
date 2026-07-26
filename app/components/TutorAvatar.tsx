"use client";

import { useEffect, useRef, useState } from "react";
import { MOODS, DEFAULT_MOOD, type MoodKey } from "../lib/moods";

// The tutor's FACE — the reactive-emotion layer that is TutorX's signature.
// It shows the current mood with the senior's own identity colour, and plays a
// mood-specific GESTURE (not one generic bounce) each time the mood changes, so a
// fired-up reaction *feels* different from a patient one. While the tutor is
// "thinking" (streaming its reply) the face gently pulses on a neutral tint.
//
// Deliberately 2D + emoji-driven (see PERSONALITIES_SPEC §3.3): a handful of
// expressive states per character is enough — photoreal talking-head video is a
// v2 flourish, not a launch-day build.
export default function TutorAvatar({
  mood = DEFAULT_MOOD,
  compact = false,
  seniorColor,
  seniorFace,
  thinking = false,
}: {
  mood?: MoodKey;
  compact?: boolean;
  /** The chosen senior's identity colour — always tints the face ring. */
  seniorColor?: string;
  /** The senior's own avatar glyph, shown at rest so it feels like THAT senior. */
  seniorFace?: string;
  /** True while the reply is still streaming — face pulses, shows a neutral face. */
  thinking?: boolean;
}) {
  const m = MOODS[mood] || MOODS[DEFAULT_MOOD];
  const [gesture, setGesture] = useState<MoodKey | null>(null);
  const prev = useRef(mood);

  // Replay the gesture whenever the mood changes (the "reaction" moment).
  useEffect(() => {
    if (prev.current !== mood) {
      prev.current = mood;
      setGesture(mood);
      const t = setTimeout(() => setGesture(null), 620);
      return () => clearTimeout(t);
    }
  }, [mood]);

  // Ring is always the senior's colour (identity); the glow tints to the mood so
  // the emotion still reads. Falls back to the mood colour if no senior given.
  const ringColor = seniorColor || m.color;

  // At rest, show the senior's own face; when reacting, show the mood face so the
  // emotion is unmistakable in the moment.
  const showMoodFace = gesture !== null || thinking || !seniorFace;
  const face = thinking ? "🤔" : showMoodFace ? m.face : seniorFace;

  return (
    <div
      className={`tutor-avatar ${compact ? "compact" : ""}`}
      style={{
        ["--mood-color" as string]: m.color,
        ["--ring-color" as string]: ringColor,
      }}
    >
      <span
        className={
          "avatar-face" +
          (gesture ? ` g-${gesture}` : "") +
          (thinking ? " is-thinking" : "")
        }
      >
        {face}
      </span>
      {!compact && (
        <span className="avatar-label">{thinking ? "thinking…" : m.label}</span>
      )}
    </div>
  );
}
