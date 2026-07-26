"use client";

import { useState } from "react";
import { PERSONALITIES, DEFAULT_PERSONALITY_ID, type TutorPersonality } from "../lib/personalities";

// "CHOOSE YOUR SENIOR" — the ownership moment.
//
// This is deliberately a ROSTER OF CHARACTERS, not a settings list. Picking a
// character (chess.com "play bots" style) makes the tutor feel like a someone, not
// a something — and, crucially, it's the first thing the student MAKES that is
// theirs. That early sense of ownership (IKEA/endowment effect) is what makes the
// rest of onboarding feel worth finishing instead of a form worth closing.
//
// Smart default: Prof. Bello is pre-selected and badged "most students start here".
// ~70–90% of users never change a default and read it as a recommendation — so the
// job here is "scan and confirm", not "research six options and decide".
export default function SeniorPicker({
  initial = DEFAULT_PERSONALITY_ID,
  onChoose,
  ctaLabel,
}: {
  initial?: string;
  onChoose: (p: TutorPersonality) => void;
  /** Override the button label; defaults to "Continue with {name} →". */
  ctaLabel?: string;
}) {
  const [selected, setSelected] = useState<string>(initial);
  const chosen = PERSONALITIES.find((p) => p.id === selected) || PERSONALITIES[0];

  return (
    <div className="senior-wrap">
      <div className="senior-head">
        <div className="logo">
          Tutor<span>X</span>
        </div>
        <h1 className="senior-title">Choose your senior 🎓</h1>
        <p className="senior-sub">
          Pick the one who&apos;ll teach you. Every senior teaches from YOUR materials — they just
          push you differently. You can switch anytime.
        </p>
      </div>

      <div className="senior-grid">
        {PERSONALITIES.map((p) => {
          const isSel = p.id === selected;
          const isDefault = p.id === DEFAULT_PERSONALITY_ID;
          return (
            <button
              key={p.id}
              className={`senior-card ${isSel ? "selected" : ""}`}
              style={{ ["--senior-color" as string]: p.color }}
              onClick={() => setSelected(p.id)}
              aria-pressed={isSel}
            >
              {isDefault && <span className="senior-badge">⭐ Most students start here</span>}
              <span className="senior-avatar">{p.avatar}</span>
              <span className="senior-name">{p.name}</span>
              <span className="senior-archetype">{p.archetype}</span>
              <span className="senior-bestfor">{p.bestFor}</span>
            </button>
          );
        })}
      </div>

      <button
        className="teach-btn big senior-cta"
        onClick={() => onChoose(chosen)}
        style={{ ["--senior-color" as string]: chosen.color }}
      >
        {ctaLabel || `Continue with ${chosen.name} →`}
      </button>
    </div>
  );
}
