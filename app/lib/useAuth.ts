"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase";
import type { User } from "@supabase/supabase-js";

// Minimal auth hook: tracks the current user and exposes sign-in helpers.
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sb = supabaseBrowser();

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithEmail(email: string, password: string, isSignUp: boolean) {
    if (isSignUp) {
      return sb.auth.signUp({ email, password });
    }
    return sb.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  return { user, loading, signInWithEmail, signOut };
}
