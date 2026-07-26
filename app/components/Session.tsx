"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Lesson from "./Lesson";
import TutorAvatar from "./TutorAvatar";
import { parseMoodTag, DEFAULT_MOOD, type MoodKey } from "../lib/moods";

type Msg = { role: "user" | "assistant"; content: string; mood?: MoodKey };

// Quick actions that just push the tutor along without the student engaging —
// used to detect coasting so the tutor can react with tough-love.
const CONTINUE_SENDS = new Set([
  "Continue teaching from where you left off.",
  "Explain that in more depth.",
  "Give me another worked example.",
]);

const QUICK_ACTIONS = [
  { label: "Explain more", send: "Explain that in more depth." },
  { label: "I don't get it", send: "I don't get it — explain it differently, simpler." },
  { label: "Another example", send: "Give me another worked example." },
  { label: "Continue", send: "Continue teaching from where you left off." },
  { label: "Quiz me", send: "Quiz me on this to check I understood." },
];

// Did the tutor's last turn ask the student to try/answer something?
function looksLikeCheck(text: string): boolean {
  return /\b(quiz|try this|your turn|what (is|do|would)|can you|answer|solve|give it a|have a go)\b/i.test(text)
    || /\?\s*$/.test(text.trim());
}

export default function Session({
  courseId,
  style,
  customInstruction,
  onFirstTopic,
}: {
  courseId: string | null;
  style: string;
  customInstruction: string;
  onFirstTopic?: (topic: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // How many times in a row the student pushed on without engaging (coasting).
  const continueStreak = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || streaming) return;
      // The first user message is the topic — surface it for the exam launcher.
      if (messages.length === 0 && onFirstTopic) onFirstTopic(clean);

      // Reaction signals: is the student coasting, and did the tutor just quiz them?
      if (CONTINUE_SENDS.has(clean)) continueStreak.current += 1;
      else continueStreak.current = 0;
      const lastTutor = [...messages].reverse().find((m) => m.role === "assistant");
      const signals = {
        continueStreak: continueStreak.current,
        lastWasCheck: lastTutor ? looksLikeCheck(lastTutor.content) : false,
      };

      const next: Msg[] = [...messages, { role: "user", content: clean }];
      setMessages(next);
      setInput("");
      setStreaming(true);
      setMessages((m) => [...m, { role: "assistant", content: "", mood: DEFAULT_MOOD }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, courseId, style, customInstruction, signals }),
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let raw = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += dec.decode(value, { stream: true });
          const { mood, rest } = parseMoodTag(raw);
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: rest, mood };
            return copy;
          });
        }
      } catch {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: "[Connection dropped — try again.]" };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, courseId, style, customInstruction, onFirstTopic]
  );

  const started = messages.length > 0;

  return (
    <div className="session">
      <div className="chat">
        {!started && (
          <div className="chat-empty">
            Ask me to teach you anything — a topic from your notes, or any subject.
            <br />I&apos;ll teach it, then you can ask me questions like a real tutor.
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg-user">{m.content}</div>
          ) : (
            <div key={i} className="msg-tutor-wrap">
              <TutorAvatar mood={m.mood} />
              <div className="msg-tutor">
                {m.content ? <Lesson text={m.content} /> : <span className="thinking">picking up the marker…</span>}
              </div>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      {started && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} className="quick-btn" onClick={() => send(a.send)} disabled={streaming}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder={started ? "Ask a question, or tell me to continue…" : "What should I teach you?"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={streaming}
        />
        <button className="chat-send" onClick={() => send(input)} disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
