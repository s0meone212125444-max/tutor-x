"use client";

import { useState } from "react";

// Subtle, tucked-away control for how the tutor teaches. Must NOT clutter the UX —
// it's a small gear that opens a popover.

const PRESETS = [
  { key: "warm", label: "Warm", blurb: "Friendly, encouraging, checks in often" },
  { key: "sharp", label: "Sharp", blurb: "Punchy, high-energy, cuts to what matters" },
  { key: "calm", label: "Calm", blurb: "Slow, patient, never makes you feel dumb" },
];

export default function StylePicker({
  style,
  customInstruction,
  onChange,
}: {
  style: string;
  customInstruction: string;
  onChange: (style: string, custom: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(customInstruction);

  return (
    <div className="style-picker">
      <button className="style-gear" onClick={() => setOpen((o) => !o)} title="How your tutor teaches">
        ⚙ Teaching style
      </button>
      {open && (
        <div className="style-pop">
          <div className="style-pop-title">How should your tutor teach you?</div>
          <div className="style-presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`style-preset ${style === p.key ? "active" : ""}`}
                onClick={() => onChange(p.key, custom)}
              >
                <div className="style-preset-label">{p.label}</div>
                <div className="style-preset-blurb">{p.blurb}</div>
              </button>
            ))}
          </div>
          <div className="style-custom-label">Or tell it exactly how (optional):</div>
          <textarea
            className="style-custom"
            placeholder="e.g. use football analogies, speak some pidgin, keep it short, be tough on me…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={2}
          />
          <button
            className="style-save"
            onClick={() => {
              onChange(style, custom);
              setOpen(false);
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
