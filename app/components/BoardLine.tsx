"use client";

import { InlineMath } from "react-katex";

// One line written on the whiteboard. Renders inline $...$ math in the
// handwriting context. Board lines are short (title / formula / step).
export default function BoardLine({ text }: { text: string }) {
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
  return <div className="board-line-written">{parts}</div>;
}
