"use client";

import { useState, useEffect, useCallback } from "react";
import { InlineMath } from "react-katex";

type Q = {
  id: number;
  type: "mcq" | "short";
  topic: string;
  question: string;
  options?: string[];
  answer: string;
  marks?: number;
  rubric?: string;
};

type MarkResult = {
  score: number;
  totalAwarded: number;
  totalPossible: number;
  results: { id: number; topic: string; awarded: number; outOf: number; correct: boolean; feedback: string }[];
  weakTopics: string[];
};

// Render text with inline $...$ math.
function withMath(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /(\$[^$]+\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`t${i}`}>{text.slice(last, m.index)}</span>);
    try {
      parts.push(<InlineMath key={`m${i}`} math={m[0].slice(1, -1)} />);
    } catch {
      parts.push(<span key={`m${i}`}>{m[0]}</span>);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) parts.push(<span key="tend">{text.slice(last)}</span>);
  return parts;
}

export default function Exam({
  questions,
  minutes,
  onReteach,
  userId,
  courseId,
  topic,
  seniorId,
  seniorName,
  formatLabel,
}: {
  questions: Q[];
  minutes: number;
  onReteach: (topic: string) => void;
  userId?: string | null;
  courseId?: string | null;
  /** For the shareable win-card. */
  topic?: string;
  seniorId?: string;
  seniorName?: string;
  formatLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [result, setResult] = useState<MarkResult | null>(null);
  const [marking, setMarking] = useState(false);

  const submit = useCallback(async () => {
    if (marking || result) return;
    setMarking(true);
    try {
      const res = await fetch("/api/exam/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers, userId, courseId }),
      });
      setResult(await res.json());
    } catch {
      setMarking(false);
    }
  }, [answers, questions, marking, result, userId, courseId]);

  // Countdown
  useEffect(() => {
    if (result) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result, submit]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // ---- RESULTS VIEW ----
  if (result) {
    const passed = result.score >= 50;
    const bossTopic = topic || result.results[0]?.topic || "the exam";
    const cardParams = new URLSearchParams({
      score: String(result.score),
      topic: bossTopic,
      senior: seniorId || "bello",
      ...(formatLabel ? { format: formatLabel } : {}),
    }).toString();
    const cardUrl = `/api/wincard?${cardParams}`;
    const shareText = passed
      ? `I just beat ${seniorName || "my tutor"}'s ${formatLabel ? formatLabel + " " : ""}${bossTopic} Boss on TutorX — ${result.score}%. It teaches from your OWN notes. Try it:`
      : `Leveling up on ${bossTopic} with TutorX — my AI tutor teaches from my own notes. Join me:`;

    async function share() {
      const url = typeof window !== "undefined" ? window.location.origin : "";
      const full = `${shareText} ${url}`;
      try {
        // Native share sheet on mobile (WhatsApp/Telegram show up here).
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: "TutorX", text: shareText, url });
          return;
        }
      } catch {
        /* fell through to clipboard */
      }
      try {
        await navigator.clipboard.writeText(full);
        alert("Copied! Paste it into your WhatsApp / Telegram status.");
      } catch {
        /* no-op */
      }
    }

    return (
      <div className="exam">
        {/* The shareable boss-battle win-card — the viral moment. */}
        <div className={`wincard ${passed ? "won" : "lost"}`} style={{ ["--senior-color" as string]: undefined }}>
          <img src={cardUrl} alt="Your result card" className="wincard-img" />
          <div className="wincard-actions">
            <button className="wincard-share" onClick={share}>
              {passed ? "📣 Share your win" : "📣 Share your progress"}
            </button>
            <a className="wincard-dl" href={cardUrl} download={`tutorx-${bossTopic}.png`} target="_blank" rel="noreferrer">
              Save image
            </a>
          </div>
        </div>

        <div className="result-score">{result.score}%</div>
        <div className="result-sub">
          {result.totalAwarded} / {result.totalPossible} marks
        </div>

        {result.weakTopics.length > 0 && (
          <div className="weak-box">
            <div className="weak-title">🎯 Your weak points — study these:</div>
            {result.weakTopics.map((t) => (
              <button key={t} className="weak-chip" onClick={() => onReteach(t)}>
                {t} → re-teach me
              </button>
            ))}
          </div>
        )}

        <div className="review">
          {result.results.map((r) => {
            const q = questions.find((x) => x.id === r.id);
            return (
              <div key={r.id} className={`review-q ${r.correct ? "ok" : "bad"}`}>
                <div className="review-qtext">
                  {r.correct ? "✅" : "❌"} {withMath(q?.question || "")}
                </div>
                <div className="review-fb">{withMath(r.feedback)}</div>
                <div className="review-marks">
                  {r.awarded}/{r.outOf} · {r.topic}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- TAKING VIEW ----
  return (
    <div className="exam">
      <div className={`timer ${secondsLeft < 60 ? "low" : ""}`}>⏱ {mm}:{ss}</div>
      {questions.map((q, idx) => (
        <div key={q.id} className="exam-q">
          <div className="exam-qnum">Q{idx + 1} · {q.marks ?? 1} mark(s)</div>
          <div className="exam-qtext">{withMath(q.question)}</div>
          {q.type === "mcq" && q.options ? (
            <div className="opts">
              {q.options.map((opt) => (
                <label key={opt} className={`opt ${answers[q.id] === opt ? "sel" : ""}`}>
                  <input
                    type="radio"
                    name={`q${q.id}`}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  />
                  {withMath(opt)}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              className="short-ans"
              placeholder="Your answer…"
              value={answers[q.id] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              rows={3}
            />
          )}
        </div>
      ))}
      <button className="teach-btn" onClick={submit} disabled={marking} style={{ width: "100%", marginTop: 10 }}>
        {marking ? "Marking…" : "Submit & face the boss"}
      </button>
    </div>
  );
}
