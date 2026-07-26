// Conversational tutoring: message history + optional course RAG context +
// personalizable style + WEB SEARCH tool (used when material doesn't cover it).
import Groq from "groq-sdk";
import { buildSystemPrompt, type ChatSignals } from "@/app/lib/teachPrompt";
import { embed } from "@/app/lib/embed";
import { supabaseAdmin } from "@/app/lib/supabase";
import { webSearch } from "@/app/lib/webSearch";

export const runtime = "nodejs";
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

type Msg = { role: "user" | "assistant"; content: string };

const SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the internet for current or missing information when the student's uploaded material and your own knowledge are not enough to teach accurately. Use for recent events, specific facts, or topics you're unsure about.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
};

export async function POST(req: Request) {
  const { messages, courseId, style, customInstruction, signals, learner, personalityId } = (await req.json()) as {
    messages: Msg[];
    courseId?: string | null;
    style?: string;
    customInstruction?: string;
    signals?: ChatSignals;
    learner?: string;
    personalityId?: string | null;
  };
  if (!messages?.length) return jsonErr("No messages");

  // 1. RAG: retrieve grounded context from the student's material for the latest turn.
  let context = "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (courseId && lastUser) {
    try {
      const qEmb = await embed(lastUser.content);
      const db = supabaseAdmin();
      const { data } = await db.rpc("match_chunks", {
        query_embedding: qEmb,
        match_course_id: courseId,
        match_count: 6,
      });
      if (data?.length) context = data.map((d: { content: string }) => d.content).join("\n\n---\n\n");
    } catch {
      /* fall back */
    }
  }

  const system = buildSystemPrompt(style, customInstruction, signals, learner, personalityId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any[] = [{ role: "system", content: system }];
  if (context) {
    base.push({
      role: "system",
      content: `Relevant excerpts from the student's uploaded material — prefer teaching from THIS:\n"""\n${context}\n"""`,
    });
  }
  for (const m of messages) base.push({ role: m.role, content: m.content });

  // 2. First pass (non-streaming): let the model decide if it needs to search.
  //    Only offer the tool when there's no strong material context.
  try {
    if (!context) {
      const decision = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: base,
        tools: [SEARCH_TOOL],
        tool_choice: "auto",
      });
      const choice = decision.choices[0].message;
      if (choice.tool_calls?.length) {
        base.push(choice);
        for (const call of choice.tool_calls) {
          let results = "";
          try {
            const args = JSON.parse(call.function.arguments || "{}");
            const found = await webSearch(args.query || lastUser?.content || "", 5);
            results = found.length
              ? found.map((r) => `• ${r.title}: ${r.snippet} (${r.url})`).join("\n")
              : "No useful results found.";
          } catch {
            results = "Search failed.";
          }
          base.push({ role: "tool", tool_call_id: call.id, content: results });
        }
      }
    }
  } catch {
    /* if tool phase fails, just stream a normal answer */
  }

  // 3. Final pass: stream the tutor's reply (now possibly informed by search).
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    max_tokens: 2000,
    stream: true,
    messages: base,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const t = chunk.choices[0]?.delta?.content || "";
          if (t) controller.enqueue(encoder.encode(t));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[Lost my train of thought — ask again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

function jsonErr(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
