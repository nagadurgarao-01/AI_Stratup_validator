"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./validate.module.css";

type Stage = "input" | "critic" | "research" | "financial" | "assets" | "complete" | "error";

interface ProgressEvent {
  stage: string;
  status: string;
  message: string;
  data?: Record<string, unknown>;
  progress: number;
}

const STAGE_LABELS: Record<string, string> = {
  critic: "Hypothesis Review",
  research: "Market Research",
  sdg: "SDG Impact Analysis",
  financial: "Financial Modeling",
  assets: "Strategy Asset Generation",
  pivot: "Pivot Strategy Generation",
  complete: "Report Ready",
};

const HYPOTHESIS_TEMPLATE =
  "Small business owners in [industry] struggle with [specific problem] because [root cause], causing them to [negative outcome].";

const EXAMPLE_IDEAS = [
  "Freelance designers struggle with invoicing because they spend 5+ hours on manual spreadsheets.",
  "Urban pet owners in India find it hard to get emergency vet care at night because clinic data is fragmented.",
  "Rural students lack access to coding mentors because they only speak Telugu or Hindi.",
  "Solo founders struggle with legal paperwork because they find the language too complex and expensive.",
  "Small cafe owners are losing customers to food apps because they lack high-quality digital menus."
];

const LANGUAGES = [
  { code: "en-US", name: "English" },
  { code: "te-IN", name: "Telugu (తెలుగు)" },
  { code: "hi-IN", name: "Hindi (हिन्दी)" },
];

export default function ValidatePage() {
  const router = useRouter();
  const [hypothesis, setHypothesis] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);

  const getApiBase = useCallback((): string => {
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      (window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : `http://${window.location.hostname}:8000`)
    );
  }, []);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const mod = await import("../../lib/firebase");
      return (await mod.auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, []);

  const postMetricEvent = useCallback(async (
    eventType: string,
    payload: Record<string, unknown> = {}
  ) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const API_BASE = getApiBase();
      await fetch(`${API_BASE}/api/metrics/event`, {
        method: "POST",
        headers,
        body: JSON.stringify({ event_type: eventType, payload }),
      });
    } catch {
      // Metrics should never block UX.
    }
  }, [getApiBase, getAuthToken]);

  useEffect(() => {
    const trackView = async () => {
      await postMetricEvent("validate_page_view");
    };

    void trackView();
  }, [postMetricEvent]);

  const handleHypothesisChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, 1000);
    setHypothesis(val);
    setCharCount(val.length);
  };

  const useTemplate = () => {
    setHypothesis(HYPOTHESIS_TEMPLATE);
    setCharCount(HYPOTHESIS_TEMPLATE.length);
  };

  const clearInput = () => {
    setHypothesis("");
    setCharCount(0);
    setError(null);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const newText = hypothesis ? `${hypothesis} ${transcript}` : transcript;
      const limitedText = newText.slice(0, 1000);
      setHypothesis(limitedText);
      setCharCount(limitedText.length);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const startValidation = async () => {
    if (hypothesis.trim().length < 20) {
      setError("Please describe your idea in at least 20 characters.");
      return;
    }

    setError(null);
    setStage("critic");
    setEvents([]);
    setProgress(5);
    setCurrentMessage("Initializing validation workflow...");

    abortRef.current = new AbortController();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const API_BASE = getApiBase();

    try {
      const response = await fetch(`${API_BASE}/api/validate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ hypothesis: hypothesis.trim() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 422 && err.detail) {
          throw new Error(err.detail);
        }
        throw new Error("Validation service is unavailable right now. Please try again shortly.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const event: ProgressEvent = JSON.parse(line.slice(5).trim());
              setProgress(event.progress);
              setCurrentMessage(event.message);
              setStage(event.stage as Stage);
              setEvents((prev) => [...prev, event]);

              if (event.stage === "complete" && event.data) {
                const fullReport = event.data as Record<string, unknown>;
                const sid = (fullReport.session_id as string) || crypto.randomUUID();
                // Store report in sessionStorage for the report page
                sessionStorage.setItem(`report_${sid}`, JSON.stringify(fullReport));
                setReportId(sid);

                const kpi = (fullReport.kpi as Record<string, unknown>) || {};
                postMetricEvent("validation_result_view_ready", {
                  session_id: sid,
                  processing_seconds: kpi.total_processing_seconds,
                  within_target: kpi.processing_within_target,
                });
              }
            } catch {
              // Ignore malformed SSE events
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setStage("error");
      setError(
        (err as Error).message ||
          "Could not connect to the validation server. Make sure the backend is running on port 8000."
      );
    }
  };

  const cancelValidation = () => {
    abortRef.current?.abort();
    setStage("input");
    setProgress(0);
    setEvents([]);
  };

  const completedStages = events.filter((e) => e.status === "complete").map((e) => e.stage);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" className={styles.back}>
            ← Back to Home
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="badge badge-green">🟢 Validation Ready</span>
          </div>
        </div>
      </header>

      <div className="container">
        <div className={styles.layout}>
          {/* Left: Input / Progress */}
          <div className={styles.mainCol}>
            {stage === "input" && (
              <div className="animate-fade-in-up">
                <div className={styles.inputHeader}>
                  <h1>Validate Your Startup Idea</h1>
                  <p>
                    Define your hypothesis and our validation workflow will research, analyze, and score your idea
                    in under 2 minutes.
                  </p>
                </div>

                <div className={`glass-card ${styles.inputCard}`}>
                  <div className={styles.templateHint}>
                    <span>💡 Use our structured template for best results</span>
                    <button className="btn btn-secondary btn-sm" onClick={useTemplate} id="use-template-btn">
                      Use Template
                    </button>
                  </div>

                  <div className={styles.inputControls}>
                    <label className={styles.label} htmlFor="hypothesis-input">
                      Your Startup Hypothesis (English, Telugu, or Hindi)
                    </label>
                    <div className={styles.languageBox}>
                      <select 
                        className={styles.langSelect} 
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.textAreaWrapper}>
                    <textarea
                      id="hypothesis-input"
                      className={`input-field ${styles.textarea}`}
                      placeholder={
                        "Example:\n\"Freelance designers struggle with writing proposals because they lack business writing skills, causing them to lose 30% of potential clients.\""
                      }
                      value={hypothesis}
                      onChange={handleHypothesisChange}
                      rows={6}
                    />
                    <button 
                      className={`${styles.voiceBtn} ${isListening ? styles.listening : ""}`}
                      onClick={toggleListening}
                      title="Voice Input"
                    >
                      {isListening ? "🛑" : "🎤"}
                    </button>
                  </div>
                  
                  <div className={styles.inputFooter}>
                    <button className={styles.clearBtn} onClick={clearInput}>Clear</button>
                    <div className={styles.charCount}>{charCount} / 1000</div>
                  </div>

                  <div className={styles.exampleChips}>
                    {EXAMPLE_IDEAS.map((idea, idx) => (
                      <button 
                        key={idx} 
                        className={styles.chip}
                        onClick={() => {
                          setHypothesis(idea);
                          setCharCount(idea.length);
                        }}
                      >
                        {idea.split(" ").slice(0, 5).join(" ")}...
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className={`badge badge-red ${styles.errorMsg}`}>{error}</div>
                  )}

                  <button
                    id="validate-btn"
                    className={`btn btn-primary btn-lg ${styles.validateBtn}`}
                    onClick={startValidation}
                    disabled={hypothesis.trim().length < 20}
                  >
                    🚀 Start Validation
                  </button>
                  <p className={styles.disclaimer}>
                    5-stage validation workflow analyzes your idea in real time
                  </p>
                </div>
              </div>
            )}

            {stage !== "input" && stage !== "error" && (
              <div className="animate-fade-in-up">
                <div className={styles.progressHeader}>
                  <h2>
                    {stage === "complete"
                      ? "🎉 Validation Complete!"
                      : "⏳ Validation In Progress..."}
                  </h2>
                  <p>{currentMessage}</p>
                </div>

                {/* Overall Progress */}
                <div className={`glass-card ${styles.progressCard}`}>
                  <div className={styles.progressMeta}>
                    <span>Overall Progress</span>
                    <span className={styles.progressPct}>{progress}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  {/* Agent Stage Indicators */}
                  <div className={styles.agentStages}>
                    {Object.entries(STAGE_LABELS).map(([key, label]) => {
                      const isComplete = completedStages.includes(key);
                      const isActive = stage === key && stage !== "complete";
                      return (
                        <div
                          key={key}
                          className={`${styles.agentStage} ${
                            isComplete ? styles.stageComplete : isActive ? styles.stageActive : styles.stagePending
                          }`}
                        >
                          <span className={styles.stageIcon}>
                            {isComplete ? "✅" : isActive ? "⚡" : "○"}
                          </span>
                          <span>{label}</span>
                          {isActive && <span className={`animate-spin ${styles.spinner}`}>⟳</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Event Stream */}
                <div className={styles.eventStream}>
                  {events.map((ev, i) => (
                    <div
                      key={i}
                      className={`${styles.eventItem} ${
                        ev.status === "complete" ? styles.eventComplete : styles.eventRunning
                      }`}
                    >
                      <span>{ev.message}</span>
                    </div>
                  ))}
                </div>

                {stage === "complete" && reportId && (
                  <div className={styles.completeActions}>
                    <button
                      id="view-report-btn"
                      className="btn btn-primary btn-lg"
                      onClick={() => router.push(`/report/${reportId}`)}
                    >
                      📊 View Full Report →
                    </button>
                    <button className="btn btn-secondary" onClick={() => setStage("input")}>
                      Validate Another Idea
                    </button>
                  </div>
                )}

                {stage !== "complete" && (
                  <button className="btn btn-secondary btn-sm" onClick={cancelValidation}>
                    Cancel
                  </button>
                )}
              </div>
            )}

            {stage === "error" && (
              <div className={`glass-card ${styles.errorCard}`}>
                <span style={{ fontSize: "2rem" }}>⚠️</span>
                <h3>Validation Failed</h3>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={() => setStage("input")}>
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Right: Tips Panel */}
          <aside className={styles.sidebar}>
            <div className={`glass-card ${styles.tipsCard}`}>
              <h3>💡 Tips for Better Results</h3>
              <ul className={styles.tipsList}>
                <li>
                  <strong>Be specific</strong> about who your customer is — not &quot;small businesses&quot; but &quot;solo
                  freelance graphic designers with 1-5 clients&quot;
                </li>
                <li>
                  <strong>Name the root cause</strong> — why does this problem exist? What systemic failure causes it?
                </li>
                <li>
                  <strong>Quantify the pain</strong> — &quot;wastes 5 hours/week&quot; is better than &quot;wastes time&quot;
                </li>
                <li>
                  <strong>Avoid solution language</strong> — describe the problem, not your product idea
                </li>
              </ul>
            </div>

            <div className={`glass-card ${styles.agentInfo}`}>
              <h3>📌 Validation Stages</h3>
              <div className={styles.agentList}>
                {[
                  { icon: "🔍", name: "Hypothesis Review", model: "Assumption checks" },
                  { icon: "🌐", name: "Market Research", model: "Demand and timing" },
                  { icon: "🌍", name: "SDG Impact", model: "UN Goal alignment" },
                  { icon: "💰", name: "Financial Modeling", model: "Viability scoring" },
                  { icon: "📄", name: "Asset Generation", model: "Strategy outputs" },
                  { icon: "🔄", name: "Pivot Strategy", model: "Risk mitigation" },
                ].map((a) => (
                  <div key={a.name} className={styles.agentListItem}>
                    <span>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{a.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{a.model}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
