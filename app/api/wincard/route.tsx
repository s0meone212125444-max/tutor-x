// The shareable WIN-CARD — the viral artifact.
//
// When a student passes a boss-battle mock, they get a card worth screenshotting:
// "I beat Prof. Bello's MTH101 Final Boss — 87%". This route renders that card as
// a real PNG so it also works as a LINK PREVIEW when the share URL is dropped into
// WhatsApp/Telegram — the post does three jobs at once (proof + brag + soft ad).
//
// Built on next/og (Satori) — no browser, fast, edge-friendly.
import { ImageResponse } from "next/og";

export const runtime = "edge";

// Senior identity colours (mirror of personalities.ts — kept inline because this
// runs on the edge runtime and we want zero heavy imports).
const SENIOR: Record<string, { name: string; color: string; face: string }> = {
  bello: { name: "Prof. Bello", color: "#c07d12", face: "🎯" },
  ada: { name: "Coach Ada", color: "#d6336c", face: "🔥" },
  igwe: { name: "Mr. Igwe", color: "#3b5bdb", face: "😤" },
  zee: { name: "Auntie Zee", color: "#0c8599", face: "😌" },
  kwame: { name: "Sensei Kwame", color: "#2b8a3e", face: "🧠" },
  kemi: { name: "Kemi", color: "#7048e8", face: "😏" },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const score = Math.max(0, Math.min(100, Number(searchParams.get("score") || 0)));
  const topic = (searchParams.get("topic") || "the exam").slice(0, 48);
  const seniorId = searchParams.get("senior") || "bello";
  const format = (searchParams.get("format") || "").slice(0, 24);
  const s = SENIOR[seniorId] || SENIOR.bello;

  const passed = score >= 50;
  const verb = passed ? "beat" : "challenged";
  const cream = "#faf7f0";
  const ink = "#1c1a15";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: cream,
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* senior colour band */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: s.color }} />

        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, color: ink }}>
          Tutor<span style={{ color: s.color }}>X</span>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 40, color: "#6c6555", display: "flex" }}>I just {verb}</div>
          <div style={{ fontSize: 76, fontWeight: 800, color: ink, lineHeight: 1.05, display: "flex", flexWrap: "wrap" }}>
            {s.name}&apos;s
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, color: s.color, lineHeight: 1.1, display: "flex" }}>
            {format ? `${format} ` : ""}{topic} Boss
          </div>
        </div>

        {/* score + face */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 150, fontWeight: 800, color: passed ? "#1f9d57" : "#d1483f", lineHeight: 1, display: "flex" }}>
              {score}%
            </div>
            <div style={{ fontSize: 30, color: "#6c6555", display: "flex" }}>
              {passed ? "study from YOUR notes → pass" : "leveling up on TutorX"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 150,
              height: 150,
              borderRadius: 999,
              background: "#fff",
              border: `6px solid ${s.color}`,
              fontSize: 84,
            }}
          >
            {s.face}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
