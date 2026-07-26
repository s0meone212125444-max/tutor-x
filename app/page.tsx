"use client";

import { useState, useEffect, useCallback } from "react";
import Exam from "./components/Exam";
import AuthGate from "./components/AuthGate";
import Lecture from "./components/Lecture";
import CourseDashboard from "./components/CourseDashboard";
import StylePicker from "./components/StylePicker";
import SeniorSwitcher from "./components/SeniorSwitcher";
import Onboarding from "./components/Onboarding";
import { useAuth } from "./lib/useAuth";
import { supabaseBrowser } from "./lib/supabase";
import { loadProfile, saveProfile, isOnboarded, learnerSummary, type StudentProfile } from "./lib/profile";
import { getPersonality } from "./lib/personalities";
import { useTheme, type ThemeChoice } from "./lib/useTheme";
import { EXAM_FORMATS, DEFAULT_FORMAT, getFormat, examMinutes, type ExamFormatId } from "./lib/examFormats";

type Course = { id: string; name: string; goal?: string; target?: string; teaching_prefs?: string | null };
type Step = { say: string; board?: string[]; kind?: string };
type Plan = { objective: string; steps: Step[] };

function TutorApp() {
  const { user, signOut } = useAuth();
  const sb = supabaseBrowser();
  const { choice: themeChoice, setTheme } = useTheme();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [newCourse, setNewCourse] = useState("");
  const [newCourseGoal, setNewCourseGoal] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");

  const [topic, setTopic] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [preparing, setPreparing] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [rate, setRate] = useState(1);

  const [mode, setMode] = useState<"class" | "exam">("class");
  const [exam, setExam] = useState<{ questions: unknown[]; minutes: number } | null>(null);
  const [examBusy, setExamBusy] = useState(false);
  const [examFormat, setExamFormat] = useState<ExamFormatId>(DEFAULT_FORMAT);

  // Exam-readiness (from persisted mastery) — the "you'll likely score X, fix
  // these" hook. null until we have exam history.
  type Readiness = {
    readiness: number;
    slipped: number;    // points lost to decay since last active — the itch
    band: { label: string; jambBand: string; tone: string };
    topicsTracked: number;
    examsTaken: number;
    dueToday: number;   // topics due for review right now — the daily return job
    weakest: { topic: string; mastery: number; slipping?: boolean }[];
  };
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  // Materials (course + upload) are tucked away by default — surfacing them only on
  // demand keeps the home screen a calm "what do you want to learn?" instead of a
  // cluttered toolbar. Progressive disclosure > decision fatigue.
  const [showMaterials, setShowMaterials] = useState(false);

  // style prefs kept for future personalization of the lecture voice/tone
  const [style, setStyle] = useState("warm");
  const [customInstruction, setCustomInstruction] = useState("");
  useEffect(() => {
    const s = localStorage.getItem("tutorx_style");
    const c = localStorage.getItem("tutorx_custom");
    const v = localStorage.getItem("tutorx_voice");
    if (s) setStyle(s);
    if (c) setCustomInstruction(c);
    if (v === "off") setVoiceEnabled(false);
  }, []);
  function saveStyle(s: string, c: string) {
    setStyle(s);
    setCustomInstruction(c);
    localStorage.setItem("tutorx_style", s);
    localStorage.setItem("tutorx_custom", c);
  }

  // Switch senior anytime — the chess.com coach-swap. Persists to the profile so
  // it sticks, and updates local state instantly so the whole UI re-voices.
  async function switchSenior(personalityId: string) {
    if (!user) return;
    setProfile((prev) => ({ ...(prev || {}), personality_id: personalityId }));
    try {
      await saveProfile(user.id, { ...(profile || {}), personality_id: personalityId });
    } catch {
      /* local state already updated; a persistence miss self-heals next save */
    }
  }

  // Load the student's profile — decides whether to show onboarding.
  useEffect(() => {
    if (!user) return;
    loadProfile().then((p) => {
      setProfile(p);
      setProfileLoaded(true);
    });
  }, [user]);

  // Handoff from LockedIn: when a student gets stuck mid-study, LockedIn deep-links
  // here as `?topic=<what they're stuck on>&from=lockedin`. We pre-fill the topic and
  // arm an auto-start so the class begins the moment they're authed + onboarded —
  // no retyping, no friction. The stuck moment flows straight into a lesson.
  const [autoStart, setAutoStart] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    if (t?.trim()) {
      setTopic(t.trim());
      if (params.get("from") === "lockedin") setAutoStart(true);
    }
  }, []);

  // Pull exam-readiness whenever we land on home (not mid-lesson/exam) so it
  // reflects the latest mock. Scoped to the selected course when one is chosen.
  const loadReadiness = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, courseId: courseId || null }),
      });
      const j = await res.json();
      setReadiness(j.ready ?? null);
    } catch {
      setReadiness(null);
    }
  }, [user, courseId]);
  useEffect(() => {
    if (!plan && mode !== "exam") loadReadiness();
  }, [plan, mode, loadReadiness]);

  const loadCourses = useCallback(async () => {
    const { data } = await sb.from("courses").select("id, name, goal, target, teaching_prefs").order("created_at");
    if (data) setCourses(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  async function createCourse() {
    if (!newCourse.trim() || !user) return;
    const { data } = await sb
      .from("courses")
      .insert({ name: newCourse.trim(), goal: newCourseGoal.trim() || null, user_id: user.id })
      .select("id, name, goal, target, teaching_prefs")
      .single();
    if (data) {
      setCourses((c) => [...c, data]);
      setCourseId(data.id);
      setNewCourse("");
      setNewCourseGoal("");
    }
  }

  async function uploadFile(file: File, kind: "material" | "past_questions") {
    if (!courseId || !user) {
      setUploadMsg("Pick or create a course first.");
      return;
    }
    setUploadMsg(`Reading & learning ${file.name}… (first upload ~30s)`);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("courseId", courseId);
    fd.append("userId", user.id);
    fd.append("title", file.name);
    fd.append("kind", kind);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await res.json();
      setUploadMsg(j.ok ? `✅ Learned ${file.name} (${j.chunks} chunks)` : `⚠️ ${j.error}`);
    } catch {
      setUploadMsg("⚠️ Upload failed.");
    }
  }

  // Teacher prepares the lesson, then the class begins. Optionally pass a topic
  // (from a tap-to-start chip) so we don't have to wait for the input's state to flush.
  async function prepareClass(topicOverride?: string) {
    const t = (topicOverride ?? topic).trim();
    if (!t || preparing) return;
    if (topicOverride) setTopic(topicOverride);
    setPreparing(true);
    setPlan(null);
    setMode("class");
    setExam(null);
    try {
      const activeCourse = courses.find((c) => c.id === courseId);
      const learner = learnerSummary(profile, activeCourse);
      const res = await fetch("/api/lecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, courseId: courseId || null, learner, personalityId: profile?.personality_id || null, userId: user?.id || null }),
      });
      const j = await res.json();
      if (j.steps?.length) setPlan(j);
      else setUploadMsg(`⚠️ ${j.error || "Could not prepare the class"}`);
    } catch {
      setUploadMsg("⚠️ Could not reach the teacher — try again.");
    } finally {
      setPreparing(false);
    }
  }

  // Reopen a saved lesson instantly — no regeneration, no model cost. This is
  // what makes a course feel like a project you resume, not a chat you restart.
  async function resumeLesson(lessonId: string) {
    if (!user || preparing) return;
    setPreparing(true);
    setPlan(null);
    setMode("class");
    setExam(null);
    try {
      const res = await fetch(`/api/lecture?lessonId=${encodeURIComponent(lessonId)}&userId=${encodeURIComponent(user.id)}`);
      const j = await res.json();
      if (j.steps?.length) setPlan(j);
      else setUploadMsg(`⚠️ ${j.error || "Could not reopen that lesson"}`);
    } catch {
      setUploadMsg("⚠️ Could not reopen that lesson — try again.");
    } finally {
      setPreparing(false);
    }
  }

  // Fire the armed LockedIn handoff exactly once, as soon as the student is ready
  // (authed + onboarded + profile loaded). Then disarm so it never re-triggers.
  useEffect(() => {
    if (!autoStart || !user || !profileLoaded) return;
    if (!isOnboarded(profile)) return;
    if (!topic.trim() || plan || preparing) return;
    setAutoStart(false);
    prepareClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, user, profileLoaded, profile, topic]);

  async function startExam(formatId?: ExamFormatId) {
    if (!topic.trim() || examBusy) return;
    const format = getFormat(formatId ?? examFormat);
    setExamBusy(true);
    setMode("exam");
    setExam(null);
    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, courseId: courseId || null, format: format.id }),
      });
      const j = await res.json();
      if (j.questions?.length) {
        setExam({ questions: j.questions, minutes: examMinutes(format, j.questions.length) });
      } else setMode("class");
    } catch {
      setMode("class");
    } finally {
      setExamBusy(false);
    }
  }

  function toggleVoice() {
    setVoiceEnabled((v) => {
      localStorage.setItem("tutorx_voice", v ? "off" : "on");
      return !v;
    });
  }

  // First-run: capture who they are and what they're aiming for.
  if (user && profileLoaded && !isOnboarded(profile)) {
    return (
      <Onboarding
        userId={user.id}
        onDone={(p) => {
          setProfile(p);
        }}
      />
    );
  }

  const senior = getPersonality(profile?.personality_id);
  const activeCourse = courses.find((c) => c.id === courseId);

  // A small, tap-to-start set of suggestions so the student rarely has to type.
  // Nudged toward their program when we know it — smart defaults over a blank prompt.
  const suggestions = SUGGESTED_TOPICS(profile?.program);

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          Tutor<span>X</span>
        </div>
        <div className="topbar-right">
          <SeniorSwitcher currentId={profile?.personality_id} onSwitch={switchSenior} />
          <div className="theme-switch" role="group" aria-label="Theme">
            {(["default", "dark", "light"] as ThemeChoice[]).map((t) => (
              <button
                key={t}
                className={`theme-opt ${themeChoice === t ? "active" : ""}`}
                onClick={() => setTheme(t)}
                title={t === "default" ? "Match device" : t}
              >
                {t === "default" ? "🌓" : t === "dark" ? "🌙" : "☀️"}
              </button>
            ))}
          </div>
          <button className={`voice-toggle ${voiceEnabled ? "on" : ""}`} onClick={toggleVoice} title="Teacher's voice">
            {voiceEnabled ? "🔊" : "🔇"}
          </button>
          <StylePicker style={style} customInstruction={customInstruction} onChange={saveStyle} />
          <button className="signout" onClick={signOut}>
            sign out
          </button>
        </div>
      </header>

      {/* Main surface */}
      {mode === "exam" && exam ? (
        <div>
          <button className="back-btn" onClick={() => setMode("class")}>
            ← back to class
          </button>
          <Exam
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            questions={exam.questions as any}
            minutes={exam.minutes}
            onReteach={() => setMode("class")}
            userId={user?.id || null}
            courseId={courseId || null}
            topic={topic || activeCourse?.name}
            seniorId={senior.id}
            seniorName={senior.name}
            formatLabel={getFormat(examFormat).label}
          />
        </div>
      ) : plan ? (
        <>
          <button className="back-btn" onClick={() => { setPlan(null); }}>
            ← done / new topic
          </button>
          <Lecture
            key={plan.objective}
            plan={plan}
            courseId={courseId || null}
            voiceEnabled={voiceEnabled}
            rate={rate}
            personalityId={profile?.personality_id || null}
          />
          {mode === "class" && (
            <div className="speed-row">
              <span>Teacher speed</span>
              <input type="range" min="0.7" max="1.3" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
          )}
        </>
      ) : preparing ? (
        <div className="home">
          <div className="preparing">
            <div className="chalk-dust" />
            {senior.name} is preparing your lesson on <b>{topic}</b>…
          </div>
        </div>
      ) : user && courseId && activeCourse && !showMaterials ? (
        /* ===== COURSE = PROJECT dashboard — the persistent workspace ===== */
        <div className="home">
          <button className="back-btn" onClick={() => setCourseId("")}>
            ← all courses
          </button>
          <CourseDashboard
            userId={user.id}
            courseId={courseId}
            courseName={activeCourse.name}
            courseGoal={activeCourse.goal}
            onTeach={(t) => {
              if (t.trim()) prepareClass(t);
              else setShowMaterials(false); // no topic: fall to the ask box below
            }}
            onExam={() => startExam()}
            onAddMaterials={() => setShowMaterials(true)}
            onResume={resumeLesson}
          />
          {/* Ask box stays available under the dashboard for free-form topics */}
          <div className="home-ask" style={{ marginTop: 20 }}>
            <input
              className="home-input"
              placeholder={`Ask ${senior.name} anything in ${activeCourse.name}…`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && prepareClass()}
            />
            <div className="home-actions">
              <button className="teach-btn big" onClick={() => prepareClass()} disabled={!topic.trim()}
                style={{ ["--senior-color" as string]: senior.color }}>
                Teach me →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ===== HOME — a calm place to start, not a toolbar ===== */
        <div className="home">
          <div className="home-hero">
            <div className="home-senior-face" style={{ ["--senior-color" as string]: senior.color }}>
              {senior.avatar}
            </div>
            <div className="home-greeting">
              {senior.name} is ready for you
            </div>
            <div className="home-sub">
              What do you want to understand today? Say it in your own words —
              I&apos;ll teach it{activeCourse ? <> from <b>{activeCourse.name}</b></> : ""}, step by step.
            </div>
          </div>

          {/* Exam-readiness — the cross-session payoff NotebookLM can't give. */}
          {readiness && (
            <div className={`readiness-card tone-${readiness.band.tone}`}>
              <div className="readiness-top">
                <div className="readiness-num">
                  <span className="readiness-pct">
                    {readiness.readiness}%
                    {readiness.slipped > 0 && (
                      <span className="readiness-slip" title="Your readiness slipped while you were away — review to bring it back up">
                        ↓ {readiness.slipped}
                      </span>
                    )}
                  </span>
                  <span className="readiness-label">
                    {readiness.slipped > 0 ? "slipping — review to recover" : readiness.band.label}
                  </span>
                </div>
                <div className="readiness-band">
                  <span className="readiness-band-title">Projected</span>
                  <span className="readiness-band-val">JAMB {readiness.band.jambBand}</span>
                </div>
              </div>

              {/* Daily-return badge: a concrete job every time you open the app. */}
              {readiness.dueToday > 0 && (
                <button
                  className="readiness-due"
                  onClick={() => prepareClass(readiness.weakest[0]?.topic)}
                  title="Review the topics due today to keep your streak of mastery"
                >
                  🔥 {readiness.dueToday} topic{readiness.dueToday === 1 ? "" : "s"} due for review today — tap to start
                </button>
              )}

              {readiness.weakest.length > 0 && (
                <>
                  <div className="readiness-hint">
                    Fix these {readiness.weakest.length} to move your score up:
                  </div>
                  <div className="readiness-weak">
                    {readiness.weakest.map((w) => (
                      <button
                        key={w.topic}
                        className={`weak-chip ${w.slipping ? "slipping" : ""}`}
                        onClick={() => prepareClass(w.topic)}
                        title={`${w.mastery}% mastery${w.slipping ? " — slipping!" : ""} — re-teach me`}
                      >
                        {w.slipping && "⚠ "}{w.topic} · {w.mastery}% → re-teach
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="home-ask">
            <input
              className="home-input"
              placeholder="e.g. Limits, Photosynthesis, Newton's second law…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && prepareClass()}
              autoFocus
            />
            <div className="home-actions">
              <button className="teach-btn big" onClick={() => prepareClass()} disabled={!topic.trim()}
                style={{ ["--senior-color" as string]: senior.color }}>
                Teach me →
              </button>
              <button className="exam-btn" onClick={() => startExam()} disabled={examBusy || !topic.trim()}>
                {examBusy ? "…" : `🎯 ${getFormat(examFormat).label} mock`}
              </button>
            </div>

            {/* Exam-format picker — the real JAMB/WAEC/university paper, not a
                generic quiz. This is what NotebookLM won't simulate. */}
            <div className="exam-format-row">
              {(Object.keys(EXAM_FORMATS) as ExamFormatId[]).map((id) => {
                const f = EXAM_FORMATS[id];
                return (
                  <button
                    key={id}
                    className={`format-chip ${examFormat === id ? "active" : ""}`}
                    onClick={() => setExamFormat(id)}
                    title={f.blurb}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="exam-format-hint">{getFormat(examFormat).blurb}</div>
          </div>

          {/* Tap-to-start chips — zero typing for the common path */}
          <div className="home-chips">
            {suggestions.map((s) => (
              <button key={s} className="home-chip" onClick={() => prepareClass(s)}>
                {s}
              </button>
            ))}
          </div>

          {/* Materials tucked away — only for those who want to teach from a PDF */}
          <div className="home-materials">
            <button className="materials-toggle" onClick={() => setShowMaterials((v) => !v)}>
              {courseId
                ? <>📚 Teaching from <b>{activeCourse?.name}</b> · change</>
                : <>📚 Add your course notes or past questions {showMaterials ? "▲" : "▼"}</>}
            </button>
            {showMaterials && (
              <div className="materials-panel">
                <div className="materials-row">
                  <select className="course-select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    <option value="">— teach from general knowledge —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="materials-row">
                  <input
                    className="topic-input"
                    placeholder="+ new course e.g. MTH101"
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCourse()}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="topic-input"
                    placeholder="goal e.g. score an A"
                    value={newCourseGoal}
                    onChange={(e) => setNewCourseGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCourse()}
                    style={{ maxWidth: 160 }}
                  />
                  <button className="teach-btn" onClick={createCourse}>Add</button>
                </div>
                {courseId && (
                  <div className="upload-row">
                    <label className="upload-btn">
                      📄 Material (PDF)
                      <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "material")} />
                    </label>
                    <label className="upload-btn">
                      📝 Past questions (PDF)
                      <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "past_questions")} />
                    </label>
                    {uploadMsg && <span className="upload-msg">{uploadMsg}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// A few sensible starter topics so the home screen offers taps, not a blank page.
// Lightly biased by program when we know it; falls back to broad first-year staples.
function SUGGESTED_TOPICS(program?: string): string[] {
  const p = (program || "").toLowerCase();
  if (/eng|mech|elec|civil|physics/.test(p))
    return ["Newton's second law", "Free body diagrams", "Kirchhoff's laws", "Limits & derivatives"];
  if (/bio|med|nurs|anat|health/.test(p))
    return ["Photosynthesis", "The cell cycle", "Enzymes", "The heart & circulation"];
  if (/account|econ|business|finance|admin/.test(p))
    return ["Demand & supply", "Double-entry bookkeeping", "Elasticity", "Opportunity cost"];
  if (/law|polit|history|arts|social/.test(p))
    return ["The rule of law", "Separation of powers", "Essay structure", "Case briefing"];
  return ["Photosynthesis", "Newton's second law", "Demand & supply", "Limits & derivatives"];
}

export default function Home() {
  return (
    <AuthGate>
      <TutorApp />
    </AuthGate>
  );
}
