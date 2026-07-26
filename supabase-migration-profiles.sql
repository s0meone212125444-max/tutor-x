-- ============================================================
-- TutorX — Migration: student profiles + course goals (goal-capture onboarding)
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1. STUDENT PROFILE — who the learner is + what they're aiming for.
create table if not exists student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school text,                 -- school / university
  program text,                -- course of study / major, e.g. "Mechanical Engineering"
  level text,                  -- year / level, e.g. "100 level", "Year 2"
  exam_period text,            -- free text, e.g. "First semester exams, Dec 2026"
  overall_goal text,           -- e.g. "Graduate with a First Class"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1b. Which "senior" (tutor personality) the student chose to be taught by.
--     Chosen once at onboarding, persists across sessions. See app/lib/personalities.ts.
alter table student_profiles add column if not exists personality_id text default 'bello';

-- 2. Per-course goal + target (add to existing courses table).
alter table courses add column if not exists goal text;        -- e.g. "Score an A"
alter table courses add column if not exists target text;      -- e.g. "Exam in 3 weeks"

-- 3. Row-level security — each user only sees their own profile.
alter table student_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'student_profiles' and policyname = 'own profile'
  ) then
    create policy "own profile" on student_profiles
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
