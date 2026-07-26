// The SHARE landing page — the other half of the viral loop.
//
// The win-card route (/api/wincard) renders a PNG. But a PNG dropped into
// WhatsApp/Telegram/X is just an image — it doesn't carry a title, a caption, or
// a link back to the app. This page does: it's a real HTML page whose OpenGraph
// tags point at that exact PNG, so pasting the SHARE URL unfurls into a rich
// card (image + "I beat Prof. Bello's MTH101 Boss — 87%" + tap-through to TutorX).
//
// So the flow is: student passes a boss mock -> shares /share?score=..&topic=..&
// senior=.. -> their friends see the card AND a button into the app. Proof, brag,
// and soft ad in one paste — with a working install link attached.

import type { Metadata } from "next";
import Link from "next/link";

export const runtime = "nodejs";

// Resolve the deployed origin so OG image URLs are ABSOLUTE (relative URLs don't
// unfurl). Prefers an explicit base, falls back to Vercel's injected host.
function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

// Senior identities (mirror of personalities.ts / wincard) — kept inline so this
// page has no heavy import just to name a tutor.
const SENIOR: Record<string, { name: string }> = {
  bello: { name: "Prof. Bello" },
  ada: { name: "Coach Ada" },
  igwe: { name: "Mr. Igwe" },
  zee: { name: "Auntie Zee" },
  kwame: { name: "Sensei Kwame" },
  kemi: { name: "Kemi" },
};

type SP = { [k: string]: string | string[] | undefined };
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function readParams(sp: SP) {
  const score = Math.max(0, Math.min(100, Number(one(sp.score)) || 0));
  const topic = (one(sp.topic) || "the exam").slice(0, 48);
  const seniorId = one(sp.senior) || "bello";
  const format = one(sp.format).slice(0, 24);
  const seniorName = (SENIOR[seniorId] || SENIOR.bello).name;
  return { score, topic, seniorId, format, seniorName, passed: score >= 50 };
}

// Dynamic OG tags — THIS is what makes the shared link unfurl into the win-card.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP> | SP;
}): Promise<Metadata> {
  const sp = await searchParams;
  const { score, topic, seniorId, format, seniorName, passed } = readParams(sp);

  const cardQ = new URLSearchParams({
    score: String(score),
    topic,
    senior: seniorId,
    ...(format ? { format } : {}),
  }).toString();
  const image = `${baseUrl()}/api/wincard?${cardQ}`;

  const title = passed
    ? `I beat ${seniorName}'s ${topic} Boss — ${score}% 🎯`
    : `Leveling up on ${topic} with TutorX`;
  const description = passed
    ? `Scored ${score}% on a timed ${format || topic} mock. TutorX teaches from your OWN notes, then drills your weak points until you're exam-ready. Try it.`
    : `My AI tutor teaches from my own notes and drills my weak points. Come level up with me.`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl()),
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// The page a friend actually lands on after tapping the unfurled card: the card
// itself + a single clear CTA into the app.
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<SP> | SP;
}) {
  const sp = await searchParams;
  const { score, topic, seniorId, format, seniorName, passed } = readParams(sp);
  const cardQ = new URLSearchParams({
    score: String(score),
    topic,
    senior: seniorId,
    ...(format ? { format } : {}),
  }).toString();
  const image = `/api/wincard?${cardQ}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24,
        background: "#faf7f0",
        color: "#1c1a15",
        fontFamily: "var(--font-round), system-ui, sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={passed ? `${score}% on ${topic}` : `Leveling up on ${topic}`}
        style={{ width: "min(560px, 92vw)", height: "auto", borderRadius: 20, boxShadow: "0 12px 40px rgba(0,0,0,.16)" }}
      />
      <p style={{ fontSize: 20, fontWeight: 700, textAlign: "center", margin: 0, maxWidth: 480, lineHeight: 1.35 }}>
        {passed
          ? `${seniorName} set the boss. It got beaten — ${score}%.`
          : `Grinding ${topic} with ${seniorName}.`}
      </p>
      <p style={{ fontSize: 16, textAlign: "center", margin: 0, maxWidth: 460, opacity: 0.8, lineHeight: 1.5 }}>
        TutorX is an AI tutor that teaches from <b>your own notes</b>, sets timed mocks
        from past questions, marks you instantly, and re-teaches your weak points.
      </p>
      <Link
        href="/"
        style={{
          background: "#1c1a15",
          color: "#faf7f0",
          padding: "16px 32px",
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 18,
          textDecoration: "none",
          fontFamily: "var(--font-display), system-ui, sans-serif",
        }}
      >
        Beat your own boss →
      </Link>
    </main>
  );
}
