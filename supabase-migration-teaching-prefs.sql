-- ============================================================
-- TutorX — Per-course teaching instructions (Projects-parity, and beyond)
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Claude/ChatGPT Projects let you set custom instructions per project. This is
-- that — but scoped to a COURSE and combined with the auto-derived memory
-- (mastery, exams, lessons) the app already tracks, so the tutor's "memory" is
-- both what the student TELLS it and what it LEARNS from the teach->test loop.
-- ============================================================

alter table courses add column if not exists teaching_prefs text;
-- e.g. "Always use Nigerian examples. I'm weak on proofs — go slower there.
--       Prefer worked examples over theory. My lecturer loves diagrams."
