-- ============================================================
-- TutorX — RETENTION ENGINE migration
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- This is the ONE migration that turns TutorX from a "teach me X" utility into a
-- product students RETURN to. It adds:
--   1. The `lessons` table (was missing — resume-where-you-left-off)
--   2. The `reviews` table — the daily spaced-repetition "due today" queue
--   3. `last_reviewed` on topic_mastery — powers readiness DECAY (the daily itch)
--
-- Safe to run more than once (idempotent: create-if-not-exists / add-column-if).
-- ============================================================

-- ------------------------------------------------------------
-- 1. LESSONS — every generated lesson saved so a course becomes a persistent
--    project the student reopens instantly (no regen, no cost).
-- ------------------------------------------------------------
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,   -- null = general lesson
  topic text not null,
  objective text,
  steps jsonb not null,
  created_at timestamptz default now()
);
create index if not exists lessons_course_idx on lessons(course_id, created_at desc);
create index if not exists lessons_user_idx   on lessons(user_id, created_at desc);
alter table lessons enable row level security;
do $$ begin
  create policy "own lessons" on lessons
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2. REVIEWS — the spaced-repetition queue. One row per (user, course, topic)
--    the student has learned/been tested on. `due_at` is when it next needs a
--    review; the home screen counts rows with due_at <= now() as "due today".
--    Scheduling uses a simple SM-2-style interval ladder (see reviews.ts).
-- ------------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  topic text not null,
  -- SR state
  interval_days numeric default 0,       -- current gap between reviews
  ease numeric default 2.5,              -- SM-2 ease factor
  reps int default 0,                    -- successful reviews in a row
  last_result numeric,                   -- 0..1 last review score
  due_at timestamptz default now(),      -- next time this topic is due
  last_reviewed timestamptz,
  created_at timestamptz default now(),
  unique (user_id, course_id, topic)
);
create index if not exists reviews_due_idx  on reviews(user_id, due_at);
create index if not exists reviews_course_idx on reviews(course_id, due_at);
alter table reviews enable row level security;
do $$ begin
  create policy "own reviews" on reviews
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 3. topic_mastery.last_reviewed — powers readiness DECAY.
--    Readiness is computed as mastery discounted by how long since last_reviewed,
--    so a topic you haven't touched in a week visibly slips (loss aversion = the
--    hunger to come back). Backfill from last_seen so existing rows aren't at 0.
-- ------------------------------------------------------------
alter table topic_mastery add column if not exists last_reviewed timestamptz;
update topic_mastery set last_reviewed = coalesce(last_reviewed, last_seen, now())
  where last_reviewed is null;
