# TutorX — Feature Roadmap to the Dream

> The dream: a virtual teacher (not a summarizer) that teaches from YOUR OWN
> materials with real voice + personality, step-by-step toward an objective,
> that you can interrupt, that quizzes you, finds your weak points, re-teaches
> them, and tracks your growth. NotebookLM-scale context, but a *teacher* on top.
>
> **Rule: ONE phase at a time, shipped and verified, before the next.** The bones
> of most of this are already built — the work is making each one feel ALIVE, not
> starting from zero. Order below is by DEPENDENCY (later needs earlier) and
> LEVERAGE (biggest feeling-of-magic per unit of work), not by the order they were
> dreamed.

---

## PHASE 0 — FOUNDATION: make it actually use your notes ⚠️ DO FIRST
**The problem:** every important feature (teach, quiz, answer) calls `embed()`,
which runs a local AI model (`@huggingface/transformers`). This likely FAILS on
Vercel's free serverless (memory/size/cold-start). When it fails, uploads don't
store, and the tutor silently teaches generic content — ignoring your material.
This is the root cause of "shallow + not using my notes."

**Steps:**
1. Add error surfacing to `/api/ingest` + `embed()` so failures are visible, not silent.
2. Test one upload on the live site; read the real error.
3. Swap local embeddings → a hosted embedding API that runs on serverless:
   - Option A: Groq/OpenAI-compatible embeddings, or
   - Option B: Supabase Edge / a small hosted `gte-small` endpoint, or
   - Option C: Jina AI free embeddings API (1M tokens free).
4. Re-embed on upload; confirm `match_chunks` returns real chunks.
5. Fix the upload FLOW trap: upload buttons only show after a course exists —
   make "create course + upload" one obvious guided step. (Course-creation error
   surfacing already shipped 2026-07-27.)

**Done when:** upload a PDF → ask the tutor about it → it answers FROM the PDF.
Without this, nothing else matters.

---

## PHASE 1 — DEPTH: teaching that feels like you learned something
**The problem:** lectures are a few shallow bullet "steps." Doesn't feel like a
real class that builds understanding.

**Steps:**
1. Rework `lecturePrompt.ts`: longer, layered lessons — hook → intuition →
   worked example → common trap → check-question, per sub-topic.
2. Pull MORE context per step (raise `match_count`, chunk-stitch) now that
   embeddings work (Phase 0).
3. Progressive objective: teacher states the objective, teaches toward it, and
   confirms it was hit at the end (partly built — deepen it).
4. Add "explain it simpler" + "give me another example" quick-actions mid-lecture.

**Done when:** a student finishes a lesson and can pass a quiz on it.

---

## PHASE 2 — VOICE: kill the robot, add a real human teacher voice
**The problem:** browser TTS (`voice.ts`) is flat and robotic — the #1 thing that
makes it feel fake.

**Steps:**
1. Integrate ElevenLabs TTS (already have keys per `skill_human_motion_graphics`).
2. Per-personality voice (each "senior" gets a distinct real voice).
3. Stream audio; keep browser-TTS as a free fallback when quota is low.
4. Sync the whiteboard writing to the voice (see Phase 3) so it feels like one
   person teaching, not audio + slides.

**Cost note:** ElevenLabs costs per character — cache generated audio per lesson
step so re-listens are free. Budget-guard it.

**Done when:** you close your eyes and it sounds like a person teaching you.

---

## PHASE 3 — UI/UX: make it FEEL like a class
**The problem:** whiteboard dumps text at once; UI doesn't feel alive or premium.

**Steps:**
1. Whiteboard writes line-by-line / word-by-word IN SYNC with the voice, in the
   handwriting font — like a hand actually writing.
2. Apply the `ux-psychology` principles (never-start-at-0, smart defaults, contrast).
3. Polish the lecture screen: teacher presence, mood animation, clean typography,
   mobile-first (most UI students are on phones).
4. Empty states that guide ("upload a note to begin") instead of dead screens.

**Done when:** it looks like a product a student would screenshot and share.

---

## PHASE 4 — THE MOAT LOOP: mock → mark → weak point → re-teach
**Why here:** this is your real defensibility (NotebookLM can't do it) and most of
it is BUILT (`exam/generate`, `exam/mark`, `mastery.ts`, decay, reviews). It needs
Phases 0–1 to feel good, then tightening.

**Steps:**
1. Timed, PQ-style mocks in real exam formats (JAMB/WAEC/uni) — formats exist in
   `examFormats.ts`, make them authentic.
2. Instant marking with clear per-question feedback (built — polish the results UI).
3. After marking: "Your weak topic is X" → one tap → tutor RE-TEACHES just X
   (wire the weak-point → lecture handoff tightly).
4. Spaced-repetition "due today" queue drives daily return (built — surface it).

**Done when:** the full teach→test→diagnose→re-teach loop runs in one sitting and
a student feels measurably readier.

---

## PHASE 5 — AUDIO OVERVIEW: listen to your notes while commuting
**The NotebookLM-killer + doubles as marketing content.**

**Steps:**
1. Generate a spoken lesson/overview from uploaded notes (needs Phase 2 voice).
2. Two-voice conversational format (teacher + student asking questions) like
   NotebookLM's audio overview — but exam-focused.
3. Downloadable / background audio player.
4. These audio clips ARE your TikTok/X content (faceless, on-brand).

**Done when:** a student plays their own notes as a podcast on the bus.

---

## PHASE 6 — STUDY ARTIFACTS: flashcards, slide deck, infographic, quiz export
**NotebookLM-parity outputs, generated from the same RAG context.**

**Steps:**
1. Flashcards (spaced-rep ready — plug into the `reviews` table).
2. Slide deck / summary view of a topic.
3. Infographic / one-page cheat-sheet (image gen or styled HTML → PNG, reuse the
   `next/og` win-card tech).
4. Export quiz as PDF for offline practice.

**Done when:** one upload → pick any format (teach / audio / cards / slides / cheat-sheet).

---

## PHASE 7 — GROWTH DASHBOARD: reports & performance over time
**The "I can see myself improving" payoff — retention gold.**

**Steps:**
1. Per-subject report: mastery, readiness, exams taken, weak topics (data already
   in `topic_mastery` + `exam_results` + decay engine).
2. Growth-over-time chart (readiness trend, topics mastered).
3. Predicted exam band + "fix these 3 to move up" (readiness route already returns this).
4. Weekly progress summary (optional email/notification later).

**Done when:** a student opens the app and SEES their progress, creating the pull
to come back.

---

## Sequencing logic (why this order)
- **0 before everything:** no notes = no product. It's the pinched fuel line.
- **1–3 make the CORE experience magical** (depth, voice, feel) — this is what
  earns your first real users and your first shareable demo clip.
- **4 is the moat** — tighten it once the core feels good.
- **5–7 are expansion** — each is a new format on top of the same engine; do them
  once 0–4 make people say "this actually taught me."

## Reality guardrails (from memory)
- Exams until 2026-06-29 → lightweight sessions; this roadmap is the post-exam plan too.
- ₦50k/mo budget → prefer free tiers; budget-guard ElevenLabs (Phase 2) & any paid API.
- Ship-first: each phase ends in a DEPLOYED, verified thing — never build 8 half-features.
- Distribution is the real gap → the moment Phase 1–3 feel good, that's the content clip.
