# TutorX outreach — the first-100-users wedge

Student-to-student cold email. You (a real student) email fellow students at the
same school about a tool that helped you pass. Peer credibility + founder-market-fit
beats any ad. Inspired by the campus-first spread in *The Social Network*.

**This is not a spam blaster.** It is a paced, personalized, one-at-a-time sender
with guardrails baked in so you don't get your account suspended.

## Setup (10 minutes, once)

```bash
cd tutorx
npm i nodemailer          # only dependency the sender needs
cp growth/.env.example growth/.env
cp growth/students.example.csv growth/students.csv
```

1. **Gmail App Password** — in `growth/.env`, set `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
   Turn on 2-Step Verification, then Google Account → Security → App passwords.
   (Your normal password will NOT work — Google blocks it for SMTP.)
2. **Fill `students.csv`** — columns: `first_name,last_name,email,confidence,note`.
   - Work out your campus email pattern from your OWN address (e.g.
     `firstname.lastname@student.unn.edu.ng` or a matric-based one).
   - Mark rows `high` when the pattern is reliable (matric-based = ~certain),
     `low` when you're guessing (middle names, duplicate names). Low rows are
     skipped unless you pass `--include-low`.
3. **Set `SENDER_NAME`, `SCHOOL`, `TUTORX_LINK`** in `.env`.

## Run

```bash
node growth/send.js                 # DRY RUN — previews copy, sends nothing
node growth/send.js --live          # send this batch (max 30)
node growth/send.js --live --limit 20
node growth/send.js --live --include-low   # also send the risky guesses
```

- **Always dry-run first** and read the two previewed emails.
- Sends **one at a time**, 45–90s apart (looks human, protects reputation).
- `sent-log.json` means re-running never double-sends. Run again tomorrow for
  the next 30.

## The guardrails (why this won't get you banned)

| Rule | Enforced by |
|------|-------------|
| Never CC/BCC a list | each email sent individually to one `to:` |
| Don't blast — warm up | `PER_RUN_CAP=30`/run + 45–90s delay |
| Don't burn on bad guesses | `low` confidence skipped by default |
| No double-sends | `sent-log.json`, written after every send |
| Don't look like a bot | 3 rotating copy variants, plain text |
| No accidental send | dry-run is the default; `--live` required |

## Copy philosophy

Plain text, one link, short, leads with THEIR exam pain. A designed HTML
"marketing" email lands in Promotions and kills the "a classmate emailed me"
trust that is the whole point. Edit `templates.js` to match how you actually talk.

## Deliverability tips

- First 2–3 days: keep it to ~15–20/day, then ramp toward 30.
- Reply to anyone who answers — replies boost your sender reputation.
- If bounces climb, your email pattern guess is wrong — fix the pattern, don't push volume.
- Send during daytime hours your recipients are awake.
