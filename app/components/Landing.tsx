"use client";

// The converting landing page — what COLD traffic (email/WhatsApp links) hits.
// A bare sign-in wall converts terribly; this sells the one thing NotebookLM
// can't do — a tutor that teaches from YOUR notes, tests you like the real exam,
// then re-teaches your weak points — and only then asks for the email.
//
// Kept intentionally single-screen-to-scroll: hero → proof → how → seniors → CTA.
export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="lp">
      {/* NAV */}
      <header className="lp-nav">
        <div className="lp-logo">Tutor<span>X</span></div>
        <button className="lp-nav-cta" onClick={onStart}>Start free</button>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-badge">🎓 Built for Nigerian students · UI first</div>
        <h1 className="lp-h1">
          The tutor that teaches from <span className="lp-ul">your own notes</span> —
          then makes sure you’ll pass.
        </h1>
        <p className="lp-sub">
          Upload your lecture material. A senior tutor teaches it to you at the board,
          out loud — you can interrupt anytime. Then face a timed mock built from your
          past questions, get marked instantly, and get re-taught exactly what you got wrong.
        </p>
        <div className="lp-cta-row">
          <button className="lp-cta" onClick={onStart}>Start learning free →</button>
          <span className="lp-cta-note">No card. Takes 30 seconds.</span>
        </div>
        <div className="lp-vs">
          NotebookLM summarizes. <strong>TutorX teaches, tests, and drills you until you’re ready.</strong>
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="lp-strip">
        <div className="lp-stat"><b>Your</b><span>notes, not generic ones</span></div>
        <div className="lp-stat"><b>Timed</b><span>mocks from past questions</span></div>
        <div className="lp-stat"><b>Instant</b><span>marking + weak-point drill</span></div>
        <div className="lp-stat"><b>Readiness %</b><span>know your score before the exam</span></div>
      </section>

      {/* HOW — the closed loop */}
      <section className="lp-how">
        <h2 className="lp-h2">The teach → test → fix loop</h2>
        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-n">1</div>
            <h3>Upload your material</h3>
            <p>Drop your lecture PDF and past questions. TutorX learns your exact syllabus.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-n">2</div>
            <h3>Get taught at the board</h3>
            <p>Your senior explains it out loud, step by step, on a live whiteboard. Interrupt to ask anything.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-n">3</div>
            <h3>Face the boss mock</h3>
            <p>A timed exam in your real format — JAMB, WAEC, uni. Marked in seconds, no waiting.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-n">4</div>
            <h3>Fix your weak points</h3>
            <p>It re-teaches exactly what you missed, then keeps them on a daily review queue so they stick.</p>
          </div>
        </div>
      </section>

      {/* SENIORS — the retention/personality hook */}
      <section className="lp-seniors">
        <h2 className="lp-h2">Choose your senior</h2>
        <p className="lp-h2-sub">Six tutors with real personalities. Pick the one that gets you to sit down and study.</p>
        <div className="lp-senior-row">
          {[
            { f: "🎯", n: "Prof. Bello", d: "Exam strategist", c: "#c07d12" },
            { f: "🔥", n: "Coach Ada", d: "Hypes you up", c: "#d6336c" },
            { f: "😤", n: "Mr. Igwe", d: "No excuses", c: "#3b5bdb" },
            { f: "😌", n: "Auntie Zee", d: "Calm & patient", c: "#0c8599" },
            { f: "🧠", n: "Sensei Kwame", d: "Deep thinker", c: "#2b8a3e" },
            { f: "😏", n: "Kemi", d: "Your smart friend", c: "#7048e8" },
          ].map((s) => (
            <div className="lp-senior" key={s.n} style={{ ["--sc" as string]: s.c }}>
              <div className="lp-senior-face">{s.f}</div>
              <div className="lp-senior-name">{s.n}</div>
              <div className="lp-senior-desc">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final">
        <h2 className="lp-h2">Stop reading. Start passing.</h2>
        <p className="lp-h2-sub">Your first class is free. Bring your notes.</p>
        <button className="lp-cta lp-cta-big" onClick={onStart}>Start learning free →</button>
      </section>

      <footer className="lp-foot">
        <span>TutorX</span>
        <span className="lp-foot-dim">Teaches you how to pass — from your own material.</span>
      </footer>
    </div>
  );
}
