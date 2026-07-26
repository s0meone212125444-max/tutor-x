// Mark a completed exam. MCQ graded instantly; open-ended graded by LLM rubric.
// Returns score, per-question results, and weak topics (topics with < full marks).
import Groq from "groq-sdk";
import { MARK_SYSTEM } from "@/app/lib/examPrompt";
import { persistExam } from "@/app/lib/mastery";

export const runtime = "nodejs";
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type Q = {
  id: number;
  type: string;
  topic: string;
  question: string;
  answer: string;
  marks?: number;
  rubric?: string;
};

export async function POST(req: Request) {
  const { questions, answers, userId, courseId } = await req.json() as {
    questions: Q[];
    answers: Record<string, string>;
    userId?: string | null;
    courseId?: string | null;
  };
  if (!questions?.length) return json({ error: "No questions" }, 400);

  const results: Array<{
    id: number;
    topic: string;
    awarded: number;
    outOf: number;
    correct: boolean;
    feedback: string;
  }> = [];

  const openEnded: Q[] = [];

  // 1. MCQ — grade instantly by exact/normalized match
  for (const q of questions) {
    const outOf = q.marks ?? 1;
    const given = (answers[String(q.id)] || "").trim();
    if (q.type === "mcq") {
      const correct = norm(given) === norm(q.answer) ||
        norm(given).charAt(0) === norm(q.answer).charAt(0); // tolerate "A" vs full text
      results.push({
        id: q.id,
        topic: q.topic,
        awarded: correct ? outOf : 0,
        outOf,
        correct,
        feedback: correct ? "Correct." : `Answer: ${q.answer}`,
      });
    } else {
      openEnded.push(q);
    }
  }

  // 2. Open-ended — grade with LLM rubric
  if (openEnded.length) {
    const payload = openEnded.map((q) => ({
      id: q.id,
      question: q.question,
      rubric: q.rubric || "",
      reference: q.answer,
      student: answers[String(q.id)] || "(no answer)",
      outOf: q.marks ?? 1,
    }));
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MARK_SYSTEM },
          { role: "user", content: JSON.stringify({ answers: payload }) },
        ],
      });
      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      for (const r of parsed.results || []) {
        const q = openEnded.find((x) => x.id === r.id);
        results.push({
          id: r.id,
          topic: q?.topic || "",
          awarded: Number(r.awarded) || 0,
          outOf: r.outOf ?? (q?.marks ?? 1),
          correct: !!r.correct,
          feedback: r.feedback || "",
        });
      }
    } catch {
      // If marking fails, award 0 with a note rather than crashing.
      for (const q of openEnded) {
        results.push({ id: q.id, topic: q.topic, awarded: 0, outOf: q.marks ?? 1, correct: false, feedback: "Could not auto-mark — review manually." });
      }
    }
  }

  results.sort((a, b) => a.id - b.id);

  // 3. Score + weak topics
  const totalAwarded = results.reduce((s, r) => s + r.awarded, 0);
  const totalPossible = results.reduce((s, r) => s + r.outOf, 0);
  const score = totalPossible ? Math.round((totalAwarded / totalPossible) * 100) : 0;

  const weakByTopic: Record<string, { got: number; max: number }> = {};
  for (const r of results) {
    if (!r.topic) continue;
    weakByTopic[r.topic] ??= { got: 0, max: 0 };
    weakByTopic[r.topic].got += r.awarded;
    weakByTopic[r.topic].max += r.outOf;
  }
  const weakTopics = Object.entries(weakByTopic)
    .filter(([, v]) => v.max > 0 && v.got / v.max < 0.6)
    .map(([topic]) => topic);

  // Persist the result + roll topic mastery forward. This is what turns a
  // one-off quiz into a loop the tutor remembers across sessions — the moat.
  // Best-effort: awaited so it lands, but never blocks the score on failure.
  await persistExam({
    userId,
    courseId,
    score,
    totalQuestions: questions.length,
    weakTopics,
    results,
  });

  return json({ score, totalAwarded, totalPossible, results, weakTopics });
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
