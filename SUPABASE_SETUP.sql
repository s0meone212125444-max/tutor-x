-- ============================================================
-- TutorX — ONE-SHOT database setup (run this whole file once)
-- Supabase Dashboard → SQL Editor → New query → paste all → Run
--
-- Fully idempotent: safe to run again. Folds together schema + every migration
-- (profiles, teaching prefs, lessons, retention engine) in the right order.
-- Embeddings are 384-dim (gte-small, computed locally — no embedding API key).
-- ============================================================

-- 1. pgvector
create extension if not exists vector;

-- ------------------------------------------------------------
-- CORE TABLES
-- ------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  exam_style text,
  created_at timestamptz default now()
);
alter table courses add column if not exists goal text;
alter table courses add column if not exists target text;
alter table courses add column if not exists teaching_prefs text;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  kind text default 'material',
  created_at timestamptz default now()
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding vector(384),
  chunk_index int,
  created_at timestamptz default now()
);
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists chunks_course_idx on chunks(course_id);

create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  score numeric,
  total_questions int,
  weak_topics text[],
  detail jsonb,
  created_at timestamptz default now()
);

create table if not exists topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  topic text not null,
  mastery numeric default 0.3,
  times_seen int default 0,
  last_seen timestamptz default now(),
  unique (user_id, course_id, topic)
);
-- readiness DECAY driver
alter table topic_mastery add column if not exists last_reviewed timestamptz;
update topic_mastery set last_reviewed = coalesce(last_reviewed, last_seen, now())
  where last_reviewed is null;

-- STUDENT PROFILE
create table if not exists student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school text, program text, level text,
  exam_period text, overall_goal text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table student_profiles add column if not exists personality_id text default 'bello';

-- LESSONS — resume-where-you-left-off
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  topic text not null,
  objective text,
  steps jsonb not null,
  created_at timestamptz default now()
);
create index if not exists lessons_course_idx on lessons(course_id, created_at desc);
create index if not exists lessons_user_idx   on lessons(user_id, created_at desc);

-- REVIEWS — spaced-repetition "due today" queue
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  topic text not null,
  interval_days numeric default 0,
  ease numeric default 2.5,
  reps int default 0,
  last_result numeric,
  due_at timestamptz default now(),
  last_reviewed timestamptz,
  created_at timestamptz default now(),
  unique (user_id, course_id, topic)
);
create index if not exists reviews_due_idx    on reviews(user_id, due_at);
create index if not exists reviews_course_idx on reviews(course_id, due_at);

-- ------------------------------------------------------------
-- MATCH FUNCTION — cosine similarity over a course's chunks
-- ------------------------------------------------------------
create or replace function match_chunks (
  query_embedding vector(384),
  match_course_id uuid,
  match_count int default 8
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.course_id = match_course_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — each user sees only their own data.
-- Idempotent: guarded so re-running never errors.
-- ------------------------------------------------------------
alter table courses          enable row level security;
alter table documents        enable row level security;
alter table chunks           enable row level security;
alter table exam_results     enable row level security;
alter table topic_mastery    enable row level security;
alter table student_profiles enable row level security;
alter table lessons          enable row level security;
alter table reviews          enable row level security;

do $$ begin create policy "own courses"  on courses      for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own documents" on documents    for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own chunks"   on chunks        for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own results"  on exam_results  for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own mastery"  on topic_mastery for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own profile"  on student_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own lessons"  on lessons       for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "own reviews"  on reviews       for all using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- Done. Verify: table editor should show courses, documents, chunks,
-- exam_results, topic_mastery, student_profiles, lessons, reviews.
