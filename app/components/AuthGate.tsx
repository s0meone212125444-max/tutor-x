"use client";

import { useState } from "react";
import { useAuth } from "../lib/useAuth";
import Landing from "./Landing";

// Wraps the app: cold visitors see the LANDING page first (which sells the
// product), and only reveal the sign-in form when they tap a CTA. Once signed
// in, they get the app. This beats a bare auth wall for conversion.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Landing → auth. New visitors land on the pitch; CTA opens the sign-up card.
  const [showAuth, setShowAuth] = useState(false);

  if (loading) return <div className="auth-wrap">Loading…</div>;
  if (user) return <>{children}</>;
  if (!showAuth) return <Landing onStart={() => { setIsSignUp(true); setShowAuth(true); }} />;

  async function submit() {
    if (!email || !password) return;
    setBusy(true);
    setMsg("");
    const { error } = await signInWithEmail(email, password, isSignUp);
    setBusy(false);
    if (error) setMsg(error.message);
    else if (isSignUp) setMsg("Check your email to confirm, then sign in.");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo" style={{ marginBottom: 6 }}>
          Tutor<span>X</span>
        </div>
        <div className="tagline" style={{ marginBottom: 20 }}>
          the tutor that teaches you how to pass
        </div>
        <input
          className="topic-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginBottom: 10, width: "100%" }}
        />
        <input
          className="topic-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ marginBottom: 14, width: "100%" }}
        />
        <button className="teach-btn" onClick={submit} disabled={busy} style={{ width: "100%" }}>
          {busy ? "…" : isSignUp ? "Create account" : "Sign in"}
        </button>
        {msg && <div className="auth-msg">{msg}</div>}
        <button className="ctx-toggle" onClick={() => setIsSignUp((s) => !s)} style={{ marginTop: 14 }}>
          {isSignUp ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
        <button className="ctx-toggle" onClick={() => setShowAuth(false)} style={{ marginTop: 8, opacity: 0.7 }}>
          ← Back
        </button>
      </div>
    </div>
  );
}
