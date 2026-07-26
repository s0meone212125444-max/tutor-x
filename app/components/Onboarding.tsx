"use client";

import { useState } from "react";
import { saveProfile, type StudentProfile } from "../lib/profile";
import SeniorPicker from "./SeniorPicker";
import { DEFAULT_PERSONALITY_ID, getPersonality } from "../lib/personalities";

// A warm, low-friction welcome — designed so it never feels like a form.
//
// The order is deliberate and psychology-led:
//  (0) CHOOSE YOUR SENIOR. The first thing they do is MAKE something theirs — pick
//      the character who'll teach them. That early ownership (IKEA/endowment effect)
//      is why the rest feels worth finishing instead of a form worth closing.
//  (1) who you are, (2) what you're aiming for — kept short, one thought per screen.
//
// Progress never starts at 0%. Picking a senior is a real first step, so we count
// it: the student sees ~33% done before they've typed a word. 0% reads as "you
// haven't started, long way to go" (deflating); a head start reads as momentum,
// which is what actually carries people through onboarding (goal-gradient effect).
export default function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (p: StudentProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<StudentProfile>({ personality_id: DEFAULT_PERSONALITY_ID });
  const [busy, setBusy] = useState(false);

  const TOTAL = 3;
  const progress = Math.round((step / TOTAL) * 100); // step 0 already = a real choice ahead

  function set<K extends keyof StudentProfile>(k: K, v: string) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  const canContinue = !!(p.school?.trim() && p.program?.trim());
  const senior = getPersonality(p.personality_id);

  async function finish() {
    setBusy(true);
    await saveProfile(userId, p);
    setBusy(false);
    onDone(p);
  }

  // Step 0 — the roster. Full-bleed, its own screen (it's the centrepiece).
  if (step === 0) {
    return (
      <div className="auth-wrap onboard-senior-wrap">
        <SeniorPicker
          initial={p.personality_id || DEFAULT_PERSONALITY_ID}
          onChoose={(chosen) => {
            set("personality_id", chosen.id);
            setStep(1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card onboard-card">
        <div className="logo" style={{ marginBottom: 4 }}>
          Tutor<span>X</span>
        </div>

        {/* Never-start-at-zero: a real head start, not a fake one — they DID pick a senior. */}
        <div className="onboard-progress">
          <div className="onboard-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="onboard-progress-label">
          {progress}% · {senior.name} is ready — just need a couple things
        </div>

        {step === 1 ? (
          <>
            <div className="onboard-title">Let&apos;s set you up 👋</div>
            <div className="onboard-sub">
              Tell {senior.name} a bit about you so they teach you like they actually know you —
              not some random chatbot.
            </div>
            <label className="onboard-label">Your school / university</label>
            <input className="topic-input onboard-input" placeholder="e.g. University of Lagos"
              value={p.school || ""} onChange={(e) => set("school", e.target.value)} autoFocus />
            <label className="onboard-label">What are you studying?</label>
            <input className="topic-input onboard-input" placeholder="e.g. Mechanical Engineering"
              value={p.program || ""} onChange={(e) => set("program", e.target.value)} />
            <label className="onboard-label">Level / year <span className="onboard-opt">(optional)</span></label>
            <input className="topic-input onboard-input" placeholder="e.g. 100 level"
              value={p.level || ""} onChange={(e) => set("level", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canContinue && setStep(2)} />
            <button className="teach-btn" disabled={!canContinue} onClick={() => setStep(2)} style={{ width: "100%", marginTop: 6 }}>
              Next →
            </button>
            <button className="ctx-toggle" onClick={() => setStep(0)} style={{ marginTop: 12 }}>
              ← change senior
            </button>
          </>
        ) : (
          <>
            <div className="onboard-title">What are we aiming for? 🎯</div>
            <div className="onboard-sub">
              Give {senior.name} your target. They&apos;ll keep it in mind every time they teach —
              everything ladders up to this.
            </div>
            <label className="onboard-label">When are your exams? <span className="onboard-opt">(optional)</span></label>
            <input className="topic-input onboard-input" placeholder="e.g. First semester exams, December"
              value={p.exam_period || ""} onChange={(e) => set("exam_period", e.target.value)} autoFocus />
            <label className="onboard-label">Your big goal this session</label>
            <input className="topic-input onboard-input" placeholder="e.g. Graduate with a First Class / Pass everything comfortably"
              value={p.overall_goal || ""} onChange={(e) => set("overall_goal", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && finish()} />
            <button className="teach-btn" disabled={busy} onClick={finish} style={{ width: "100%", marginTop: 6 }}>
              {busy ? "Setting up…" : `Start learning with ${senior.name} →`}
            </button>
            <button className="ctx-toggle" onClick={() => setStep(1)} style={{ marginTop: 12 }}>
              ← back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
