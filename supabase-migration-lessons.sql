-- ============================================================
-- TutorX — Lesson history (resume-where-you-left-off)
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Makes a course a PERSISTENT project: every generated lesson is saved so the
-- student can reopen it instantly (no regeneration, no cost) instead of the
-- tutor starting blank every time — the thing generic chat/NotebookLM can't do.
-- ============================================================

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,   -- null = general-knowledge lesson
  topic text not null,
  objective text,
  steps jsonb not null,                    -- the full ordered say/board plan
  created_at timestamptz default now()
);

create index if not exists lessons_course_idx on lessons(course_id, created_at desc);
create index if not exists lessons_user_idx   on lessons(user_id, created_at desc);

alter table lessons enable row level security;

create policy "own lessons" on lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
