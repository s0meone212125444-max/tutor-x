"use client";

import { useEffect, useState, useCallback } from "react";

// Theme is the student's choice: "default" tracks their device, "dark"/"light" are
// explicit. We store the CHOICE (3 options) but resolve it to a concrete dark/light
// on <html data-theme>, which the CSS variables key off. A pre-paint script in
// layout.tsx already applied it once; this hook keeps React in sync and lets the
// user change it live.
export type ThemeChoice = "default" | "dark" | "light";

function resolve(choice: ThemeChoice): "dark" | "light" {
  if (choice === "dark") return "dark";
  if (choice === "light") return "light";
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function useTheme() {
  // New users land on the clean CREAM look (light) by default; night owls can
  // flip to dark, and that choice persists. "default" (OS-following) remains
  // available only if explicitly chosen.
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("tutorx_theme") as ThemeChoice) || "light";
    setChoice(saved);
  }, []);

  const apply = useCallback((next: ThemeChoice) => {
    setChoice(next);
    localStorage.setItem("tutorx_theme", next);
    document.documentElement.setAttribute("data-theme", resolve(next));
  }, []);

  // When on "default", follow the OS if it changes mid-session.
  useEffect(() => {
    if (choice !== "default") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolve("default"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  return { choice, setTheme: apply, resolved: resolve(choice) };
}
