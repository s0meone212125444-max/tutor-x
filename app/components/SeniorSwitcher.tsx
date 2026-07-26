"use client";

import { useState } from "react";
import { PERSONALITIES, getPersonality } from "../lib/personalities";

// The chess.com coach-swap, made good on. The SeniorPicker at onboarding promises
// "you can switch anytime" — this is the anytime. A small face-chip in the header
// opens the full roster; picking a new senior re-voices the whole app instantly.
// Kept as a popover (not a settings page) so swapping feels playful, not buried.
export default function SeniorSwitcher({
  currentId,
  onSwitch,
}: {
  currentId?: string | null;
  onSwitch: (personalityId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = getPersonality(currentId);

  return (
    <div className="senior-switch">
      <button
        className="senior-chip"
        onClick={() => setOpen((o) => !o)}
        title={`Your senior: ${current.name} — tap to switch`}
        style={{ ["--senior-color" as string]: current.color }}
      >
        <span className="senior-chip-face">{current.avatar}</span>
        <span className="senior-chip-name">{current.name}</span>
        <span className="senior-chip-caret">⌄</span>
      </button>

      {open && (
        <>
          <div className="senior-switch-scrim" onClick={() => setOpen(false)} />
          <div className="senior-switch-pop">
            <div className="senior-switch-title">Switch your senior</div>
            <div className="senior-switch-sub">
              Same materials — a different push. Your progress carries over.
            </div>
            <div className="senior-switch-list">
              {PERSONALITIES.map((p) => {
                const isCur = p.id === current.id;
                return (
                  <button
                    key={p.id}
                    className={`senior-switch-row ${isCur ? "current" : ""}`}
                    style={{ ["--senior-color" as string]: p.color }}
                    onClick={() => {
                      if (!isCur) onSwitch(p.id);
                      setOpen(false);
                    }}
                  >
                    <span className="senior-switch-face">{p.avatar}</span>
                    <span className="senior-switch-meta">
                      <span className="senior-switch-name">
                        {p.name}
                        {isCur && <span className="senior-switch-badge">current</span>}
                      </span>
                      <span className="senior-switch-arch">{p.archetype}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
