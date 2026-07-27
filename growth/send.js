#!/usr/bin/env node
// TutorX student-to-student email sender — the first-100-users wedge.
//
//   node growth/send.js --dry           # preview only, sends NOTHING (default)
//   node growth/send.js --live          # actually send this batch
//   node growth/send.js --live --limit 20
//
// Enforces the guardrails from the growth plan IN CODE so you can't foot-gun:
//   • individual sends (never CC/BCC a list) with a randomized human delay
//   • hard per-run cap (default 30) so you warm the account, not blast it
//   • only sends confidence=high rows unless --include-low
//   • dedupes against growth/sent-log.json — safe to re-run, never double-sends
//   • rotates 3 copy variants so a batch isn't 30 identical bodies
//   • dry-run by DEFAULT — you must pass --live to send
//
// SETUP (once):
//   1. npm i nodemailer csv-parse
//   2. Create growth/.env  (see growth/.env.example) with a Gmail App Password
//      (Google account -> Security -> 2FA on -> App passwords). NOT your login pw.
//   3. Fill growth/students.csv (copy students.example.csv). Get high-confidence
//      rows from the campus email pattern; flag guesses as low.

const fs = require("fs");
const path = require("path");
const { pickFor } = require("./templates");

// ---- tiny .env loader (no dependency) ------------------------------------
(function loadEnv() {
  const p = path.join(__dirname, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

// ---- config (env with sane defaults) -------------------------------------
const CFG = {
  school: process.env.SCHOOL || "our school",
  senderName: process.env.SENDER_NAME || "a fellow student",
  link: process.env.TUTORX_LINK || "https://tutor-x-five.vercel.app/",
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  perRunCap: Number(process.env.PER_RUN_CAP || 30),
  minDelayMs: Number(process.env.MIN_DELAY_MS || 45000), // 45s
  maxDelayMs: Number(process.env.MAX_DELAY_MS || 90000), // 90s
};

// ---- args ----------------------------------------------------------------
const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const INCLUDE_LOW = args.includes("--include-low");
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : CFG.perRunCap;
const CAP = Math.min(LIMIT, CFG.perRunCap);

const SENT_LOG = path.join(__dirname, "sent-log.json");
const CSV = path.join(__dirname, "students.csv");

function loadSent() {
  try { return new Set(JSON.parse(fs.readFileSync(SENT_LOG, "utf8"))); }
  catch { return new Set(); }
}
function saveSent(set) {
  fs.writeFileSync(SENT_LOG, JSON.stringify([...set], null, 2));
}

// minimal CSV parse (handles simple quoted fields)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = lines.shift().split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cells = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
    return row;
  });
}

function fill(tpl, row, index) {
  const course = row.course || "your exams";
  return tpl
    .replaceAll("{{first_name}}", row.first_name || "there")
    .replaceAll("{{school}}", CFG.school)
    .replaceAll("{{sender_name}}", CFG.senderName)
    .replaceAll("{{course}}", course)
    .replaceAll("{{link}}", CFG.link);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function jitter() { return CFG.minDelayMs + Math.floor(Math.random() * (CFG.maxDelayMs - CFG.minDelayMs)); }

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`\n✗ Missing ${CSV}\n  Copy students.example.csv -> students.csv and fill it.\n`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CSV, "utf8"));
  const sent = loadSent();

  // Build the eligible queue with all guardrails applied.
  const skipped = { nolink: 0, badformat: 0, lowconf: 0, already: 0, dupe: 0 };
  const seen = new Set();
  const queue = [];
  for (const row of rows) {
    const email = (row.email || "").toLowerCase();
    if (!email) { skipped.nolink++; continue; }
    if (!EMAIL_RE.test(email)) { skipped.badformat++; continue; }
    if (seen.has(email)) { skipped.dupe++; continue; }
    seen.add(email);
    if (sent.has(email)) { skipped.already++; continue; }
    const conf = (row.confidence || "").toLowerCase();
    if (conf !== "high" && !INCLUDE_LOW) { skipped.lowconf++; continue; }
    queue.push(row);
  }

  const batch = queue.slice(0, CAP);

  console.log(`\n═══ TutorX outreach ═══`);
  console.log(`Mode        : ${LIVE ? "🔴 LIVE (will send)" : "🟢 DRY RUN (no send)"}`);
  console.log(`From        : ${CFG.senderName} <${CFG.gmailUser || "??? set GMAIL_USER"}>`);
  console.log(`Link        : ${CFG.link}`);
  console.log(`Eligible    : ${queue.length}   Sending now: ${batch.length} (cap ${CAP})`);
  console.log(`Skipped     : already=${skipped.already} lowConf=${skipped.lowconf} noEmail=${skipped.nolink} badFormat=${skipped.badformat} dupe=${skipped.dupe}`);
  console.log(`Pacing      : ${CFG.minDelayMs / 1000}-${CFG.maxDelayMs / 1000}s between each (individual sends)\n`);

  if (!batch.length) { console.log("Nothing to send. Done.\n"); return; }

  // DRY: print the first 2 rendered emails so you can proof the copy.
  if (!LIVE) {
    batch.slice(0, 2).forEach((row, i) => {
      const { subject, body } = pickFor(i);
      console.log(`──── preview #${i + 1} → ${row.email} ────`);
      console.log(`Subject: ${fill(subject, row, i)}`);
      console.log(fill(body, row, i));
      console.log("");
    });
    console.log(`(${batch.length} queued. Re-run with --live to send. Proof the copy above first.)\n`);
    return;
  }

  // LIVE: require creds + nodemailer, send one-by-one with delay.
  if (!CFG.gmailUser || !CFG.gmailAppPassword) {
    console.error("✗ Set GMAIL_USER and GMAIL_APP_PASSWORD in growth/.env before --live.\n");
    process.exit(1);
  }
  let nodemailer;
  try { nodemailer = require("nodemailer"); }
  catch { console.error("✗ Run: npm i nodemailer\n"); process.exit(1); }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: CFG.gmailUser, pass: CFG.gmailAppPassword },
  });
  await transport.verify().catch((e) => {
    console.error("✗ Gmail auth failed:", e.message, "\n  (Use an App Password, and make sure 2FA is on.)\n");
    process.exit(1);
  });

  let ok = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const { subject, body } = pickFor(i);
    try {
      await transport.sendMail({
        from: `${CFG.senderName} <${CFG.gmailUser}>`,
        to: row.email, // individual send — NEVER bcc a list
        subject: fill(subject, row, i),
        text: fill(body, row, i), // plain text on purpose
      });
      sent.add(row.email.toLowerCase());
      saveSent(sent); // persist after EACH send so a crash never double-sends
      ok++;
      console.log(`✓ ${i + 1}/${batch.length}  ${row.email}`);
    } catch (e) {
      fail++;
      console.log(`✗ ${i + 1}/${batch.length}  ${row.email}  — ${e.message}`);
    }
    if (i < batch.length - 1) {
      const d = jitter();
      console.log(`   …waiting ${Math.round(d / 1000)}s`);
      await sleep(d);
    }
  }
  console.log(`\nDone. Sent ${ok}, failed ${fail}. Logged to sent-log.json.`);
  console.log(`Run again tomorrow for the next ${CAP} — pace beats blast.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
