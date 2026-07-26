// Exam formats — TutorX's defensible wedge. NotebookLM/Gemini generate generic
// quizzes; they do NOT simulate the ACTUAL exam a Nigerian student sits. Each
// format below drives (a) how questions are generated, (b) timing, and (c) how
// they're marked — so a mock *feels* like the real JAMB CBT / WAEC paper.

export type ExamFormatId = "jamb" | "waec" | "university" | "quick";

export type ExamFormat = {
  id: ExamFormatId;
  label: string; // shown on the format chip
  blurb: string; // one line under the chip
  defaultCount: number; // questions per mock
  minutesPerQuestion: number; // drives the countdown
  negativeMarking: boolean; // JAMB doesn't, some do — surfaced to the student
  /// Extra instruction appended to the exam-generation system prompt so the
  /// LLM mirrors this exam's real style, phrasing, and question mix.
  promptGuidance: string;
};

export const EXAM_FORMATS: Record<ExamFormatId, ExamFormat> = {
  jamb: {
    id: "jamb",
    label: "JAMB (UTME)",
    blurb: "CBT-style multiple choice, tightly timed",
    defaultCount: 10,
    minutesPerQuestion: 0.75, // ~45s/question, like the real CBT pace
    negativeMarking: false,
    promptGuidance: `Format: JAMB UTME CBT. ALL questions must be 4-option multiple choice (A–D), single correct answer. Match JAMB's exact register: concise stems, one-line options, application/recall balance, and the classic distractor traps JAMB uses (off-by-one calculations, unit swaps, "all of the above" bait, near-synonyms). No theory/essay questions. Keep each question answerable in under a minute.`,
  },
  waec: {
    id: "waec",
    label: "WAEC (WASSCE)",
    blurb: "Objectives + theory, like the real paper",
    defaultCount: 8,
    minutesPerQuestion: 2.5,
    negativeMarking: false,
    promptGuidance: `Format: WAEC WASSCE. Mix objective (MCQ) and theory (short/structured) questions roughly 50/50. Theory questions must use WAEC command words ("State", "Explain", "Describe", "Calculate", "With the aid of a diagram…") and carry multi-mark rubrics with mark-per-point breakdowns, exactly how WAEC allocates marks. Objectives are 4-option MCQ.`,
  },
  university: {
    id: "university",
    label: "University exam",
    blurb: "Your lecturer's style, from your material",
    defaultCount: 6,
    minutesPerQuestion: 4,
    negativeMarking: false,
    promptGuidance: `Format: university semester exam. Lean on the uploaded past questions and course material to mirror how THIS lecturer sets questions — their phrasing, favourite topics, and depth. Prefer structured/theory questions that test application and derivation over pure recall. Include at least one multi-part question if the material supports it.`,
  },
  quick: {
    id: "quick",
    label: "Quick check",
    blurb: "5 fast questions to test yourself",
    defaultCount: 5,
    minutesPerQuestion: 1.5,
    negativeMarking: false,
    promptGuidance: `Format: quick self-check. A short mixed set to surface weak spots fast. Mostly MCQ with one or two short-answer.`,
  },
};

export const DEFAULT_FORMAT: ExamFormatId = "quick";

export function getFormat(id?: string | null): ExamFormat {
  if (id && id in EXAM_FORMATS) return EXAM_FORMATS[id as ExamFormatId];
  return EXAM_FORMATS[DEFAULT_FORMAT];
}

/// Total minutes for a mock of [count] questions in this format (min 3).
export function examMinutes(format: ExamFormat, count: number): number {
  return Math.max(3, Math.round(format.minutesPerQuestion * count));
}
