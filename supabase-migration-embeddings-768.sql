-- ============================================================
-- TutorX — PHASE 0 migration: move embeddings to 768-dim (Gemini)
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- We swapped the embedding engine from a local 384-dim model (couldn't run on
-- Vercel serverless) to Google Gemini text-embedding-004, which returns 768 dims.
-- The `chunks.embedding` column and the match_chunks() function must match.
--
-- SAFE: uploads were failing before, so there are no real embeddings to lose.
-- We drop the old index + column and recreate at 768. If you somehow had valid
-- 384-dim rows you cared about, they'd need re-ingesting anyway (different model).
-- ============================================================

-- 1. Drop the old vector index (tied to the old column type).
drop index if exists chunks_embedding_idx;

-- 2. Clear any stale 384-dim rows and re-type the column to 768.
--    (truncate is fine — this data can only be old/failed ingests.)
truncate table chunks;
alter table chunks alter column embedding type vector(768);

-- 3. Recreate the similarity index at the new dimension.
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 4. Recreate match_chunks with a 768-dim query parameter.
create or replace function match_chunks (
  query_embedding vector(768),
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
