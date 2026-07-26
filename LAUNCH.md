# TutorX — Launch Runbook

Everything is built and the production build passes (`npx next build` ✓).
Three things need YOUR accounts to go live. ~20 minutes total.

---

## ✅ Already done (in code)
- Landing page at `/` that sells the product to cold traffic (email/WhatsApp links land here, not a login wall).
- Retention flywheel: readiness **decay** (topics slip when idle) + **daily review queue** (spaced repetition) + **boss-battle win-cards** (shareable PNG for WhatsApp/Telegram).
- Six senior tutor personalities with facial expressions + gestures.
- All API routes, KaTeX board, doc ingestion, timed mocks, instant marking, re-teach loop.
- Production build is clean; `.env.local` is gitignored (your real keys are NOT in git).

---

## STEP 1 — Database (5 min)
1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste **all of `SUPABASE_SETUP.sql`** and click **Run**.
3. It's idempotent — safe to run again. You should see these tables in the Table Editor:
   `courses, documents, chunks, exam_results, topic_mastery, student_profiles, lessons, reviews`.

> This one file replaces all the older `supabase-migration-*.sql` files. You only need to run `SUPABASE_SETUP.sql`.

---

## STEP 2 — Deploy to Vercel (10 min)
The project is a local git repo with a commit ready, but **no GitHub remote yet**.

**A. Push to GitHub**
```powershell
# In C:\Users\HP 840 G3\tutorx
# 1. Create an empty repo on github.com (e.g. "tutorx"), then:
git remote add origin https://github.com/<you>/tutorx.git
git branch -M main
git push -u origin main
```

**B. Import on Vercel**
1. vercel.com → **Add New → Project** → import the `tutorx` repo.
2. Framework preset should auto-detect **Next.js**. If it says "Other", set it to Next.js manually (otherwise every route 404s).
3. Add **Environment Variables** (copy the values from your local `.env.local`):

   | Name | Where to get it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → publishable/anon key |
   | `SUPABASE_SECRET_KEY` | Supabase → Settings → API → secret/service_role key |
   | `GROQ_API_KEY` | console.groq.com → API Keys |

4. **Deploy.** You'll get a `tutorx-*.vercel.app` URL.

**C. Point Supabase Auth at the live URL**
- Supabase → **Authentication → URL Configuration** → set **Site URL** to your Vercel URL, and add it to **Redirect URLs**. (Otherwise email confirmation links break.)

---

## STEP 3 — Broadcast channel (2 min)
Create ONE channel to post updates + win-cards. Pick the one your UI students already use — **WhatsApp Channel** is the safest bet.

- **WhatsApp Channel**: WhatsApp → Updates tab → ➕ → New channel → "TutorX". Post the link in your bio + first outreach emails.
- **Telegram** (alternative): create a public channel `t.me/tutorx`, pin a welcome + the app link.

Put the channel link in ONE place students will see it: the win-card share text already drives them to the app; the app can later carry a "join the channel" nudge (say the word and I'll add it).

---

## STEP 4 — First 100 users (email wedge)
- Roster CSV is at `C:\Users\HP 840 G3\Downloads\tutorx_ui_students_2025-26.csv` (4,316 UI students, email pattern decoded and verified against your own address).
- Start with a **small batch (20–30/day)** to protect deliverability — don't blast 4k at once or you'll get flagged.
- The hook that converts: *"I built an AI tutor that teaches from YOUR uploaded notes and gives you timed mocks marked instantly. Free. Try it before the semester gets heavy: <link>"*

---

## Pricing
Deliberately **off** for launch. Ship free, get returns + shares, then gate the boss-battle mocks / multi-course once you see which students come back daily. Say the word when you're ready and I'll wire it in.
