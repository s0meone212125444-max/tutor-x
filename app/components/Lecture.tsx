"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import BoardLine from "./BoardLine";
import TutorAvatar from "./TutorAvatar";
import { DEFAULT_MOOD, isMoodKey, type MoodKey } from "../lib/moods";
import { createSpeaker, createListener, type Speaker } from "../lib/voice";
import { getPersonality } from "../lib/personalities";

type Step = { say: string; board?: string[]; kind?: string; mood?: string };
type Plan = { objective: string; steps: Step[] };

// A step's declared mood, or a sensible default derived from its kind.
function moodForStep(step?: Step): MoodKey {
  if (step?.mood && isMoodKey(step.mood)) return step.mood;
  switch (step?.kind) {
    case "intro": return "fired_up";
    case "trap": return "serious";
    case "check": return "playful";
    case "example": return "teaching";
    default: return DEFAULT_MOOD;
  }
}

type BoardItem = { text: string; kind: string; fromQuestion?: boolean };

// The LECTURE — a class you attend. The teacher speaks each step aloud while
// writing on the whiteboard, progresses toward the objective, and you can
// raise your hand to pause, ask, and resume.
export default function Lecture({
  plan,
  courseId,
  voiceEnabled,
  rate,
  personalityId,
}: {
  plan: Plan;
  courseId: string | null;
  voiceEnabled: boolean;
  rate: number;
  personalityId?: string | null;
}) {
  const [stepIdx, setStepIdx] = useState(-1); // -1 = not started
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [status, setStatus] = useState<"idle" | "teaching" | "paused" | "asking" | "done">("idle");
  const [handQuestion, setHandQuestion] = useState("");
  const [caption, setCaption] = useState("");
  const [mood, setMood] = useState<MoodKey>(DEFAULT_MOOD);

  const speakerRef = useRef<Speaker | null>(null);
  const cancelledRef = useRef(false);
  const boardEndRef = useRef<HTMLDivElement>(null);
  const handRaiseCount = useRef(0); // total hand-raises this lecture (for tough-love)

  useEffect(() => {
    speakerRef.current = createSpeaker({ rate });
  }, [rate]);

  useEffect(() => {
    boardEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [board, caption]);

  // Teach one step: reveal its board lines while speaking its narration.
  const teachStep = useCallback(
    async (idx: number) => {
      const step = plan.steps[idx];
      if (!step) return;
      setMood(moodForStep(step));
      setCaption(step.say);
      // Write the board lines for this step
      if (step.board?.length) {
        setBoard((b) => [...b, ...step.board!.map((t) => ({ text: t, kind: step.kind || "concept" }))]);
      }
      if (voiceEnabled && speakerRef.current?.isSupported) {
        await speakerRef.current.speak(step.say);
      } else {
        // No voice: give a readable pause proportional to text length
        await new Promise((r) => setTimeout(r, Math.min(6000, 1200 + step.say.length * 35)));
      }
    },
    [plan, voiceEnabled]
  );

  // Run the lecture from a given step forward.
  const runFrom = useCallback(
    async (start: number) => {
      cancelledRef.current = false;
      setStatus("teaching");
      for (let i = start; i < plan.steps.length; i++) {
        if (cancelledRef.current) return;
        setStepIdx(i);
        await teachStep(i);
        if (cancelledRef.current) return;
      }
      setStatus("done");
      setMood("proud");
      setCaption("That's the lesson. Raise your hand if you want anything explained again — or try a mock exam.");
    },
    [plan, teachStep]
  );

  function start() {
    setBoard([]);
    runFrom(0);
  }

  function raiseHand() {
    cancelledRef.current = true;
    speakerRef.current?.stop();
    setMood("teaching");
    setStatus("asking");
  }

  function resume() {
    // Continue from the next step after the one we paused on.
    setStatus("teaching");
    runFrom(Math.min(stepIdx + 1, plan.steps.length));
  }

  // Ask the teacher (raise hand), get an in-character answer on the board + aloud.
  async function askTeacher(question: string) {
    const q = question.trim();
    if (!q) return;
    handRaiseCount.current += 1;
    setHandQuestion("");
    setBoard((b) => [...b, { text: `❓ ${q}`, kind: "question", fromQuestion: true }]);
    setCaption("Good question — let me answer that…");
    try {
      const res = await fetch("/api/lecture/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: plan.objective,
          currentStepSay: plan.steps[stepIdx]?.say || "",
          question: q,
          courseId,
          handRaiseCount: handRaiseCount.current,
          personalityId,
        }),
      });
      const ans = await res.json();
      if (ans.mood && isMoodKey(ans.mood)) setMood(ans.mood);
      if (ans.board?.length) {
        setBoard((b) => [...b, ...ans.board.map((t: string) => ({ text: t, kind: "answer", fromQuestion: true }))]);
      }
      setCaption(ans.say);
      if (voiceEnabled && speakerRef.current?.isSupported) {
        await speakerRef.current.speak(ans.say);
      }
    } catch {
      setCaption("Let me get back to that — let's continue.");
    }
    setStatus("paused");
  }

  // Voice raise-hand
  const [listening, setListening] = useState(false);
  function listen() {
    const listener = createListener((text) => {
      setListening(false);
      askTeacher(text);
    });
    if (!listener.isSupported) return;
    setListening(true);
    raiseHand();
    listener.start();
  }

  const progress = stepIdx >= 0 ? Math.round(((stepIdx + 1) / plan.steps.length) * 100) : 0;
  const senior = getPersonality(personalityId);

  return (
    <div className="lecture">
      {/* Objective + progress */}
      <div className="lecture-head">
        <div className="lecture-teacher" style={{ ["--senior-color" as string]: senior.color }}>
          <span className="lecture-teacher-face">{senior.avatar}</span>
          <span className="lecture-teacher-name">{senior.name}</span>
          <span className="lecture-teacher-role">is teaching</span>
        </div>
        <div className="lecture-objective">🎯 {plan.objective}</div>
        <div className="lecture-progress">
          <div className="lecture-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* The whiteboard */}
      <div className="whiteboard">
        {board.length === 0 && status === "idle" && (
          <div className="whiteboard-empty">
            Your teacher is ready. Press <b>Start the class</b> and they&apos;ll teach you at the board.
          </div>
        )}
        {board.map((item, i) => (
          <div key={i} className={`wb-item wb-${item.kind}`}>
            <BoardLine text={item.text} />
          </div>
        ))}
        <div ref={boardEndRef} />
      </div>

      {/* Teacher's spoken caption — the avatar's face reacts to what's happening */}
      {caption && (
        <div className="caption">
          <TutorAvatar
            mood={mood}
            compact
            seniorColor={senior.color}
            seniorFace={senior.avatar}
            thinking={status === "asking"}
          />
          <span className="caption-text">{caption}</span>
        </div>
      )}

      {/* Controls */}
      <div className="lecture-controls">
        {status === "idle" && (
          <button className="teach-btn big" onClick={start}>
            ▶ Start the class
          </button>
        )}
        {status === "teaching" && (
          <>
            <button className="hand-btn" onClick={raiseHand}>
              ✋ Raise your hand
            </button>
            <button className="hand-btn voice" onClick={listen} disabled={listening}>
              🎤 Ask by voice
            </button>
          </>
        )}
        {(status === "paused" || status === "asking") && (
          <>
            <input
              className="hand-input"
              placeholder="Ask your teacher anything about this…"
              value={handQuestion}
              onChange={(e) => setHandQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askTeacher(handQuestion)}
              autoFocus
            />
            <button className="teach-btn" onClick={() => askTeacher(handQuestion)} disabled={!handQuestion.trim()}>
              Ask
            </button>
            <button className="hand-btn" onClick={resume}>
              ▶ Continue lesson
            </button>
          </>
        )}
        {status === "done" && (
          <button className="hand-btn" onClick={() => { setStatus("paused"); }}>
            ✋ Ask a question
          </button>
        )}
      </div>
    </div>
  );
}
