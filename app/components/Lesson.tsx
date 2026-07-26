"use client";

import { InlineMath, BlockMath } from "react-katex";

// Renders one tutor message: section headers, bold, bullets, numbered steps,
// and inline/display LaTeX — cleanly formatted for readability.

const SECTION_COLORS: Record<string, string> = {
  "📖": "#8ecae6",
  "🔧": "#ffb703",
  "✍️": "#ffffff",
  "⚡": "#95d5b2",
  "⏭️": "#adb5bd",
  "🎭": "#ff8fa3",
  "🎯": "#ffd166",
  "✅": "#95d5b2",
};

// Inline renderer: handles $...$, $$...$$, and **bold**.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on math first so we don't bold inside formulas.
  const mathRe = /(\$\$[^$]+\$\$|\$[^$]+\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = mathRe.exec(text)) !== null) {
    if (m.index > last) parts.push(...renderBold(text.slice(last, m.index), `${keyBase}-b${i}`));
    const tok = m[0];
    try {
      if (tok.startsWith("$$")) parts.push(<BlockMath key={`${keyBase}-m${i}`} math={tok.slice(2, -2)} />);
      else parts.push(<InlineMath key={`${keyBase}-m${i}`} math={tok.slice(1, -1)} />);
    } catch {
      parts.push(<span key={`${keyBase}-m${i}`}>{tok}</span>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) parts.push(...renderBold(text.slice(last), `${keyBase}-bend`));
  return parts;
}

function renderBold(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</span>);
    out.push(<strong key={`${keyBase}-s${i}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(<span key={`${keyBase}-tend`}>{text.slice(last)}</span>);
  return out;
}

export default function Lesson({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="lesson">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed === "") return <div key={idx} className="lesson-gap" />;

        // Section header (starts with a known emoji)
        const emoji = Object.keys(SECTION_COLORS).find((e) => trimmed.startsWith(e));
        if (emoji && trimmed.length < 60) {
          return (
            <h3 key={idx} className="lesson-section" style={{ color: SECTION_COLORS[emoji], borderColor: SECTION_COLORS[emoji] }}>
              {trimmed}
            </h3>
          );
        }

        // Numbered step (1. 2. ...)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="lesson-step">
              <span className="lesson-num">{numMatch[1]}</span>
              <span>{renderInline(numMatch[2], `l${idx}`)}</span>
            </div>
          );
        }

        // Bullet
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="lesson-bullet">
              <span className="lesson-dot">•</span>
              <span>{renderInline(trimmed.replace(/^[-•*]\s+/, ""), `l${idx}`)}</span>
            </div>
          );
        }

        return <p key={idx} className="lesson-line">{renderInline(line, `l${idx}`)}</p>;
      })}
    </div>
  );
}
