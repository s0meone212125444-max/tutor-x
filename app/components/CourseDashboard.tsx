"use client";

import { useState, useEffect, useCallback } from "react";

// The "Course = Project" home. A persistent workspace that shows everything
// TutorX remembers for this course in one place — materials, the mastery map,
// past exams, readiness — so opening a course feels like resuming a project
// that knows you, not starting a blank chat. (Claude/ChatGPT Projects insight.)

type Doc = { id: string; title: string; kind: string; created_at: string };
type MasteryTopic = { topic: string; mastery: number; timesSeen: number };
type ExamRow = { id: string; score: number; totalQuestions: number; weakTopics: string[]; createdAt: string };
type LessonRow = { id: string; topic: string; objective: string; createdAt: string };

type CourseData = {
  documents: Doc[];
  materialsCount: number;
  pastQCount: number;
  mastery: MasteryTopic[];
  exams: ExamRow[];
  lessons: LessonRow[];
  teachingPrefs: string;
  remembers: string[];
  readiness: number | null;
  band: string | null;
};

function masteryColor(pct: number): string {
  if (pct >= 80) return "#16a34a";
  if (pct >= 60) return "var(--accent)";
  if (pct >= 40) return "#d97706";
  return "#dc2626";
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function CourseDashboard({
  userId,
  courseId,
  courseName,
  courseGoal,
  onTeach,
  onExam,
  onAddMaterials,
  onResume,
}: {
  userId: string;
  courseId: string;
  courseName: string;
  courseGoal?: string;
  onTeach: (topic: string) => void;
  onExam: () => void;
  onAddMaterials: () => void;
  onResume: (lessonId: string) => void;
}) {
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable per-course teaching instructions (the Projects "custom instructions").
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, courseId }),
      });
      const j = (await res.json()) as CourseData;
      setData(j);
      setPrefsDraft(j.teachingPrefs || "");
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, courseId]);

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      await fetch("/api/course", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, courseId, teachingPrefs: prefsDraft }),
      });
      setData((d) => (d ? { ...d, teachingPrefs: prefsDraft } : d));
      setEditingPrefs(false);
    } finally {
      setSavingPrefs(false);
    }
  }
  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="course-dash">
        <div className="cd-skel cd-skel-hero" />
        <div className="cd-skel-row">
          <div className="cd-skel cd-skel-card" />
          <div className="cd-skel cd-skel-card" />
        </div>
      </div>
    );
  }

  const d = data;
  const hasMastery = (d?.mastery.length ?? 0) > 0;
  const hasExams = (d?.exams.length ?? 0) > 0;
  const hasDocs = (d?.documents.length ?? 0) > 0;
  const lessons = d?.lessons ?? [];
  const lastLesson = lessons[0];

  return (
    <div className="course-dash">
      {/* Header: course + goal + readiness */}
      <div className="cd-hero">
        <div className="cd-hero-left">
          <div className="cd-course-name">{courseName}</div>
          {courseGoal ? (
            <div className="cd-course-goal">🎯 {courseGoal}</div>
          ) : (
            <div className="cd-course-goal muted">Your persistent study project</div>
          )}
        </div>
        {d?.readiness != null && (
          <div className="cd-readiness">
            <div className="cd-readiness-pct">{d.readiness}%</div>
            <div className="cd-readiness-band">{d.band}</div>
          </div>
        )}
      </div>

      {/* Primary actions */}
      <div className="cd-actions">
        <button className="cd-btn primary" onClick={() => onTeach("")}>
          ▶ Teach me
        </button>
        <button className="cd-btn" onClick={onExam}>
          🎯 Mock exam
        </button>
        <button className="cd-btn ghost" onClick={onAddMaterials}>
          📄 Materials
        </button>
      </div>

      {/* Resume hook — the single most "it remembers me" moment. Only shows
          once there's a lesson to return to. */}
      {lastLesson && (
        <button className="cd-resume" onClick={() => onResume(lastLesson.id)}>
          <span className="cd-resume-label">↩ Continue where you left off</span>
          <span className="cd-resume-topic">{lastLesson.objective}</span>
          <span className="cd-resume-when">{timeAgo(lastLesson.createdAt)}</span>
        </button>
      )}

      {/* WHAT YOUR TUTOR REMEMBERS — the signature "it knows me" panel. Unlike
          Projects (a passive folder), this is auto-derived from how you've
          actually worked, and grows every lesson & exam. */}
      {(d?.remembers?.length ?? 0) > 0 && (
        <div className="cd-memory">
          <div className="cd-memory-title">🧠 What {courseName ? "your tutor" : "I"} remember{courseName ? "s" : ""} about you</div>
          <ul className="cd-memory-list">
            {d!.remembers.map((r, i) => (
              <li key={i} className="cd-memory-item">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Standing instructions — Projects "custom instructions", per course */}
      <div className="cd-prefs">
        <div className="cd-prefs-head">
          <span className="cd-prefs-title">📌 How I should teach this course</span>
          {!editingPrefs && (
            <button className="cd-btn ghost small" onClick={() => setEditingPrefs(true)}>
              {d?.teachingPrefs ? "edit" : "+ add"}
            </button>
          )}
        </div>
        {editingPrefs ? (
          <>
            <textarea
              className="cd-prefs-input"
              value={prefsDraft}
              maxLength={1000}
              placeholder="e.g. Always use Nigerian examples. Go slower on proofs. Prefer worked examples over theory. My lecturer loves diagrams."
              onChange={(e) => setPrefsDraft(e.target.value)}
              autoFocus
            />
            <div className="cd-prefs-actions">
              <button className="cd-btn primary small" onClick={savePrefs} disabled={savingPrefs}>
                {savingPrefs ? "saving…" : "save"}
              </button>
              <button className="cd-btn ghost small" onClick={() => { setPrefsDraft(d?.teachingPrefs || ""); setEditingPrefs(false); }}>
                cancel
              </button>
            </div>
          </>
        ) : d?.teachingPrefs ? (
          <div className="cd-prefs-text">“{d.teachingPrefs}”</div>
        ) : (
          <div className="cd-empty">
            Set standing rules and every senior follows them in this course — your
            examples, your pace, what your lecturer wants.
          </div>
        )}
      </div>

      {/* Lesson history — a course is a project you resume, not a blank chat */}
      {lessons.length > 1 && (
        <div className="cd-section">
          <div className="cd-section-title">
            📖 Your lessons
            <span className="cd-count">{lessons.length}</span>
          </div>
          <div className="cd-lessons">
            {lessons.slice(1).map((l) => (
              <button key={l.id} className="cd-lesson-row" onClick={() => onResume(l.id)}
                title="Reopen this lesson — instant, no waiting">
                <span className="cd-lesson-topic">{l.objective}</span>
                <span className="cd-lesson-when">{timeAgo(l.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mastery map — the structured memory competitors don't have */}
      <div className="cd-section">
        <div className="cd-section-title">
          📊 Mastery map
          {hasMastery && <span className="cd-count">{d!.mastery.length} topics</span>}
        </div>
        {hasMastery ? (
          <div className="cd-mastery">
            {d!.mastery.map((m) => (
              <button
                key={m.topic}
                className="cd-mastery-row"
                onClick={() => onTeach(m.topic)}
                title={`${m.mastery}% · seen ${m.timesSeen}× · tap to re-teach`}
              >
                <span className="cd-mastery-topic">{m.topic}</span>
                <span className="cd-mastery-bar">
                  <span
                    className="cd-mastery-fill"
                    style={{ width: `${m.mastery}%`, background: masteryColor(m.mastery) }}
                  />
                </span>
                <span className="cd-mastery-pct" style={{ color: masteryColor(m.mastery) }}>
                  {m.mastery}%
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="cd-empty">
            Take a mock exam and your weak & strong topics will map out here — then
            your tutor teaches straight to your gaps.
          </div>
        )}
      </div>

      {/* Past exams */}
      <div className="cd-section">
        <div className="cd-section-title">
          📝 Past mocks
          {hasExams && <span className="cd-count">{d!.exams.length}</span>}
        </div>
        {hasExams ? (
          <div className="cd-exams">
            {d!.exams.map((e) => (
              <div key={e.id} className="cd-exam-row">
                <span className="cd-exam-score" style={{ color: masteryColor(e.score) }}>
                  {e.score}%
                </span>
                <span className="cd-exam-meta">
                  {e.totalQuestions} Qs · {timeAgo(e.createdAt)}
                </span>
                {e.weakTopics.length > 0 && (
                  <span className="cd-exam-weak">weak: {e.weakTopics.slice(0, 2).join(", ")}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="cd-empty">No mocks yet. Your first one sets your baseline.</div>
        )}
      </div>

      {/* Materials (Project Knowledge) */}
      <div className="cd-section">
        <div className="cd-section-title">
          📚 Materials
          {hasDocs && <span className="cd-count">{d!.materialsCount} notes · {d!.pastQCount} past-Q</span>}
        </div>
        {hasDocs ? (
          <div className="cd-docs">
            {d!.documents.map((doc) => (
              <div key={doc.id} className="cd-doc-row">
                <span className="cd-doc-icon">{doc.kind === "past_questions" ? "📝" : "📄"}</span>
                <span className="cd-doc-title">{doc.title}</span>
                <span className="cd-doc-kind">{doc.kind === "past_questions" ? "past-Q" : "notes"}</span>
              </div>
            ))}
            <button className="cd-btn ghost small" onClick={onAddMaterials}>+ add more</button>
          </div>
        ) : (
          <div className="cd-empty">
            Upload your lecturer&apos;s notes or past questions — the tutor teaches from
            <b> your</b> material, not a generic textbook.
            <button className="cd-btn ghost small" onClick={onAddMaterials} style={{ marginTop: 10 }}>
              📄 Add materials
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
