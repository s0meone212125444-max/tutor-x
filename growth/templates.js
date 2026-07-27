// Email copy for the student-to-student wedge.
//
// DESIGN RULES (why this copy looks the way it does):
//  1. PLAIN TEXT, no HTML, no images, no logo. A designed "marketing" email
//     destroys the "a classmate emailed me" credibility that is the entire point
//     of this wedge — and lands in Promotions/Spam. This must read like a real
//     student typed it to another student in the same school.
//  2. ONE link, once, low in the body. Multiple links + "click here" buttons are
//     the #1 spam signal for cold mail from a personal account.
//  3. Lead with THEIR pain (the specific exam/course), not the product. The offer
//     is framed as "a thing that helped me," reciprocity not a pitch.
//  4. Short. 60–90 words. A long email from a stranger gets deleted.
//  5. Three rotating variants so a batch of 30 isn't 30 identical bodies
//     (identical mass-content is a spam heuristic). Pick by index.
//
// Available merge fields: {{first_name}} {{school}} {{sender_name}} {{course}} {{link}}
// {{course}} defaults to "your exams" if you don't have per-student course data.

const SUBJECTS = [
  "{{first_name}}, this helped me survive {{course}}",
  "{{first_name}} — the thing I used to actually pass",
  "quick one {{first_name}} (fellow {{school}} student)",
];

const BODIES = [
  // Variant A — "I built/found this and it saved me" (founder-market-fit angle)
  `Hey {{first_name}},

I'm {{sender_name}}, also at {{school}}. Random message, but bear with me —
I was drowning in {{course}} last sem, so I started using a tool that teaches
straight from YOUR OWN notes and past questions, then gives you timed mock
exams and marks you instantly. It's the only reason I stopped cramming blindly.

It's free to try. If you've got an exam coming, it's worth 2 minutes:
{{link}}

No pressure — just thought a fellow {{school}} student should know it exists.
— {{sender_name}}`,

  // Variant B — "spotted your struggle" peer angle (shorter, more casual)
  `{{first_name}}, hey — {{sender_name}} here, same school.

Quick one: if you're stressing about {{course}}, there's a free AI tutor that reads
your own notes and past questions, teaches you the topic, then sets timed mock
exams and grades you on the spot. It literally tells you which topics you're
weak on so you stop wasting time.

Take a look before your next exam: {{link}}

That's it. Good luck this sem 🙏
— {{sender_name}}`,

  // Variant C — "one tip" reciprocity angle (gives value, soft ask)
  `Hi {{first_name}},

{{sender_name}} from {{school}}. One tip that changed how I study {{course}}:
stop re-reading notes and start testing yourself. I use a free tool that turns
my own notes + past questions into real timed mocks and marks them instantly,
then re-teaches whatever I got wrong.

If that sounds useful, it's here: {{link}}

Hope your exams go well.
— {{sender_name}}`,
];

// Deterministic pick so a given student always gets the same variant on resend.
function pickFor(index) {
  const i = ((index % 3) + 3) % 3;
  return { subject: SUBJECTS[i], body: BODIES[i] };
}

module.exports = { SUBJECTS, BODIES, pickFor };
