// Raise-your-hand: answer the student's mid-lecture question IN CHARACTER
// (something to say + optional board lines), grounded in their material.
import Groq from "groq-sdk";
import { ANSWER_SYSTEM, buildAnswerUser, withPersonality } from "@/app/lib/lecturePrompt";
import { embed } from "@/app/lib/embed";
import { supabaseAdmin } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 45;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { objective, currentStepSay, question, courseId, handRaiseCount, personalityId } = await req.json();
  if (!question) return json({ error: "Missing question" }, 400);

  let context = "";
  if (courseId) {
    try {
      const qEmb = await embed(question);
      const db = supabaseAdmin();
      const { data } = await db.rpc("match_chunks", {
        query_embedding: qEmb,
        match_course_id: courseId,
        match_count: 5,
      });
      if (data?.length) context = data.map((d: { content: string }) => d.content).join("\n\n");
    } catch {
      /* ignore */
    }
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: withPersonality(ANSWER_SYSTEM, personalityId) },
        {
          role: "user",
          content: buildAnswerUser({ objective: objective || "", currentStepSay: currentStepSay || "", question, context, handRaiseCount }),
        },
      ],
    });
    const ans = JSON.parse(completion.choices[0].message.content || "{}");
    return json({ say: ans.say || "Good question — let me clarify.", board: ans.board || [], mood: ans.mood || "patient" });
  } catch {
    return json({ say: "Good question — let's keep going and it'll click.", board: [], mood: "patient" });
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
