"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./report.module.css";
import { generatePDF } from "../../../utils/pdfGenerator";

// ── Viability Gauge Component ─────────────────────────────────────────────────
function ViabilityGauge({ score, color }: { score: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 5000;
    const steps = 60;
    const stepValue = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= score) {
        setDisplayed(score);
        clearInterval(timer);
      } else {
        setDisplayed(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [score]);

  // SVG Arc gauge
  const size = 200;
  const radius = 80;
  const cx = size / 2;
  const cy = 120;
  const startAngle = -200;
  const endAngle = 20;
  const totalAngle = endAngle - startAngle;
  const scoreAngle = startAngle + (displayed / 100) * totalAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (start: number, end: number, r: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)), y: cy + r * Math.sin(toRad(end)) };
    const large = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const gaugeColor = color === "green" ? "#10b981" : color === "amber" ? "#f59e0b" : "#ef4444";

  return (
    <div className={styles.gauge}>
      <svg width={size} height={140} viewBox={`0 0 ${size} 140`}>
        {/* Track */}
        <path d={arcPath(startAngle, endAngle, radius)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" strokeLinecap="round" />
        {/* Red zone */}
        <path d={arcPath(startAngle, startAngle + totalAngle * 0.4, radius)} fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="16" strokeLinecap="round" />
        {/* Amber zone */}
        <path d={arcPath(startAngle + totalAngle * 0.4, startAngle + totalAngle * 0.7, radius)} fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth="16" strokeLinecap="round" />
        {/* Green zone */}
        <path d={arcPath(startAngle + totalAngle * 0.7, endAngle, radius)} fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="16" strokeLinecap="round" />
        {/* Score fill */}
        {displayed > 0 && (
          <path d={arcPath(startAngle, scoreAngle, radius)} fill="none" stroke={gaugeColor} strokeWidth="16" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${gaugeColor})` }} />
        )}
        {/* Center score text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="36" fontFamily="'Cal Sans', sans-serif" fontWeight="600">
          {displayed}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12" fontFamily="Inter, sans-serif">
          / 100
        </text>
      </svg>
    </div>
  );
}

// ── Market Bar Component ───────────────────────────────────────────────────────
function MarketBar({ label, value, formatted, color }: { label: string; value: number; formatted: string; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(value), 300); }, [value]);
  return (
    <div className={styles.marketBarItem}>
      <div className={styles.marketBarLabel}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{formatted}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main Report Page ───────────────────────────────────────────────────────────
export default function ReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<"mentor" | "overview" | "market" | "competitors" | "financial" | "sdg" | "assets" | "pivots">("mentor");
  const [isFetchingServerReport, setIsFetchingServerReport] = useState(false);
  const [serverFetchError, setServerFetchError] = useState<string | null>(null);
  const attemptedServerLoadRef = useRef(false);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const mod = await import("../../../lib/firebase");
      return (await mod.auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }

    const recordView = async () => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = await getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

      try {
        await fetch(`${API_BASE}/api/metrics/event`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            event_type: "report_page_view",
            payload: { session_id: id },
          }),
        });
      } catch {
        // Ignore telemetry failure in UI flow.
      }
    };

    void recordView();
  }, [getAuthToken, id]);

  const loadFromBackend = useCallback(async (showErrorMessage = true) => {
    if (!id) {
      return;
    }

    setServerFetchError(null);
    setIsFetchingServerReport(true);
    try {
      const headers: Record<string, string> = {};
      const token = await getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

      const response = await fetch(`${API_BASE}/api/report/${id}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error("This report is currently unavailable.");
      }

      const payload = (await response.json()) as Record<string, unknown>;
      sessionStorage.setItem(`report_${id}`, JSON.stringify(payload));
      setReport(payload);
    } catch (error) {
      if (showErrorMessage) {
        setServerFetchError((error as Error).message || "Unable to load your report right now.");
      }
    } finally {
      setIsFetchingServerReport(false);
    }
  }, [getAuthToken, id]);

  useEffect(() => {
    if (!id || report || attemptedServerLoadRef.current) {
      return;
    }

    // Try loading from sessionStorage first (client-side only)
    const stored = sessionStorage.getItem(`report_${id}`);
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        return;
      } catch (e) {
        console.error("Failed to parse stored report", e);
      }
    }

    attemptedServerLoadRef.current = true;
    void loadFromBackend(false);
  }, [id, loadFromBackend, report]);

  if (!report) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className={`glass-card ${styles.noReport}`}>
          <span style={{ fontSize: "3rem" }}>📭</span>
          <h2>Report Not Found</h2>
          <p>This report may have expired or wasn&apos;t saved correctly.</p>
          <button className="btn btn-secondary" onClick={() => void loadFromBackend()} disabled={isFetchingServerReport}>
            {isFetchingServerReport ? "Loading from backend..." : "Try Load from Backend"}
          </button>
          {serverFetchError && <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{serverFetchError}</p>}
          <Link href="/validate" className="btn btn-primary">Start a New Validation</Link>
        </div>
      </div>
    );
  }

  const financial = (report.financial_model as Record<string, unknown>) || {};
  const market = (report.market_research as Record<string, unknown>) || {};
  const competitors = (report.competitor_intel as Record<string, unknown>) || {};
  const critic = (report.critic as Record<string, unknown>) || {};
  const assets = (report.assets as Record<string, unknown>) || {};
  const score = (financial.viability_score as number) || 0;
  const color = (financial.viability_color as string) || "amber";
  const label = (financial.viability_label as string) || "Moderate Viability";
  const metrics = (financial.market_metrics as Record<string, unknown>) || {};
  const kpi = (report.kpi as Record<string, unknown>) || {};
  const breakdown = (financial.score_breakdown as Record<string, unknown>) || {};
  const directCompetitors = (competitors.direct_competitors as unknown[]) || [];
  const blueOcean = (competitors.blue_ocean_strategy as Record<string, unknown[]>) || {};
  const brandIdentity = (assets.brand_identity as Record<string, unknown>) || {};
  const businessPlan = (assets.business_plan_outline as Record<string, unknown>) || {};
  const asst = assets;
  const mr = market;
  const comp = competitors;
  const fin = financial;
  const sdg = (report.sdg as Record<string, unknown>) || {};
  const pivots = (report.pivots as unknown[]) || [];

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" className={styles.back}>⚡ ValidateAI</Link>
          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => generatePDF(report, id)}
            >
              📥 Download PDF
            </button>
            <Link href="/validate" className="btn btn-primary btn-sm">Validate Another</Link>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Hero Score Card */}
        <div className={`glass-card ${styles.heroCard}`}>
          <div className={styles.heroLeft}>
            <div className={styles.heroMeta}>
              <span className={`badge badge-${color}`}>
                {color === "green" ? "🟢" : color === "amber" ? "🟡" : "🔴"} {label}
              </span>
              <span className={styles.sessionId}>Session: {id?.slice(0, 8)}</span>
              {typeof kpi.total_processing_seconds === "number" && (
                <span className={`badge ${kpi.processing_within_target ? "badge-green" : "badge-amber"}`}>
                  ⏱ {kpi.total_processing_seconds}s
                </span>
              )}
            </div>
            <h1 className={styles.heroTitle}>Your Startup Validation Report</h1>
            <p className={styles.heroHypothesis}>
              &ldquo;{(critic.refined_hypothesis as string) || "Your refined hypothesis"}&rdquo;
            </p>
            <div className={styles.scoreBreakdown}>
              {[
                { label: "Demand Signal", value: breakdown.demand_signal as number || 0, weight: "40%" },
                { label: "Competitive Gap", value: breakdown.competitive_gap as number || 0, weight: "35%" },
                { label: "Feasibility", value: breakdown.feasibility as number || 0, weight: "25%" },
              ].map((b) => (
                <div key={b.label} className={styles.breakdownItem}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{b.label}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{Math.round(b.value)}/100</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${b.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.heroRight}>
            <ViabilityGauge score={score} color={color} />
            <p className={styles.gaugeLabel}>Viability Score™</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === "mentor" ? styles.tabActive : ""}`} onClick={() => setActiveTab("mentor")}>
            🎓 Mentor
          </button>
          <button className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`} onClick={() => setActiveTab("overview")}>
            📋 Summary
          </button>
          {(["market", "competitors", "financial", "sdg", "assets", "pivots"] as const).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
              id={`tab-${tab}`}
            >
              {tab === "market" && "📊 Market"}
              {tab === "competitors" && "⚔️ Competitors"}
              {tab === "financial" && "💰 Financials"}
              {tab === "sdg" && "🌍 SDG Impact"}
              {tab === "assets" && "📄 Business Plan"}
              {tab === "pivots" && "🔄 Pivots"}
            </button>
          ))}
        </div>

        {/* ── Mentor Tab ── */}
        {activeTab === "mentor" && (
          <div className="animate-fade-in">
            <div className={styles.mentorReport}>
              <div className={styles.mentorHeader}>
                <div className={styles.projectIdentity}>
                  <span className="badge badge-purple">Innovation Mentor 2026</span>
                  <h2>{asst.pitch_helper?.project_title || "Refined Project Title"}</h2>
                  <p className={styles.elevatorPitch}>&quot;{asst.pitch_helper?.elevator_pitch || "Your elevator pitch is being generated..."}&quot;</p>
                </div>
                <div className={styles.verdictBadge}>
                  <div className={styles.overallScoreCircle}>
                    <span className={styles.scoreVal}>{fin.llm_financial_model?.overall_score || fin.viability_score}</span>
                    <span className={styles.scoreLab}>Overall</span>
                  </div>
                  <div className={styles.verdictText}>
                    <div className={styles.verdictLabel}>{fin.llm_financial_model?.verdict || fin.viability_label} Verdict</div>
                    <ul className={styles.verdictReasons}>
                      {(fin.llm_financial_model?.verdict_reasons || ["Viable market pain", "Growing trend", "Technical feasibility"]).map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className={styles.mentorGrid}>
                {/* 1. Extraction */}
                <section className={`glass-card ${styles.mentorCard}`}>
                  <h3>1. Extraction</h3>
                  <ul className={styles.mentorList}>
                    <li><strong>Target Users:</strong> {critic.extraction?.target_users}</li>
                    <li><strong>Core Problem:</strong> {critic.extraction?.core_problem}</li>
                    <li><strong>Root Cause:</strong> {critic.extraction?.root_cause}</li>
                    <li><strong>Impact:</strong> {critic.extraction?.impact}</li>
                  </ul>
                </section>

                {/* 2. Validation Problem Clarity */}
                <section className={`glass-card ${styles.mentorCard}`}>
                  <h3>2. Problem Clarity</h3>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLab}>Clarity Score</span>
                    <span className={styles.metricVal}>{critic.clarity_score || 0}/10</span>
                  </div>
                  <p className={styles.mentorHint}><strong>Mentor Suggestion:</strong> {critic.improvement_suggestions}</p>
                </section>

                {/* 3. Market Research */}
                <section className={`glass-card ${styles.mentorCard}`}>
                  <h3>3. Market Research</h3>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricMini}>
                      <span>Demand</span>
                      <strong>{mr.demand_level || "Medium"}</strong>
                    </div>
                    <div className={styles.metricMini}>
                      <span>Audience</span>
                      <strong>{mr.audience_size || "Medium"}</strong>
                    </div>
                    <div className={styles.metricMini}>
                      <span>Trend</span>
                      <strong>{mr.market_trends?.trend_insight || "Stable"}</strong>
                    </div>
                  </div>
                </section>

                {/* 4. Competitor Analysis */}
                <section className={`glass-card ${styles.mentorCard} ${styles.fullWidth}`}>
                  <h3>4. Competitor Analysis</h3>
                  <div className={styles.competitorGridSimple}>
                    {comp.direct_competitors?.slice(0, 5).map((c: any, i: number) => (
                      <div key={i} className={styles.compSimple}>
                        <h4>{c.name} <span>(Direct)</span></h4>
                        <div className={styles.sw}>
                          <span className={styles.s}>+ {c.strengths?.[0]}</span>
                          <span className={styles.w}>- {c.weaknesses?.[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.metricRow} style={{ marginTop: "1rem" }}>
                    <span>Market Saturation</span>
                    <strong>{comp.market_saturation || "Medium"}</strong>
                  </div>
                </section>

                {/* 5. Innovation & Uniqueness */}
                <section className={`glass-card ${styles.mentorCard}`}>
                  <h3>5. Innovation</h3>
                  <div className={styles.metricRow}>
                    <span>Uniqueness</span>
                    <span className={styles.metricVal}>{comp.uniqueness_score || 0}%</span>
                  </div>
                  <p className={styles.mentorText}>{comp.innovation_explanation}</p>
                </section>

                {/* 6 & 7. Feasibility & Financials */}
                <section className={`glass-card ${styles.mentorCard}`}>
                  <h3>6 & 7. Feasibility & Financials</h3>
                  <ul className={styles.mentorList}>
                    <li><strong>Tech:</strong> {fin.llm_financial_model?.technical_feasibility}</li>
                    <li><strong>Cost:</strong> {fin.llm_financial_model?.cost_level}</li>
                    <li><strong>Revenue:</strong> {fin.llm_financial_model?.revenue_model_suggestion}</li>
                    <li><strong>Potential:</strong> {fin.llm_financial_model?.earning_potential_range}</li>
                  </ul>
                </section>

                {/* 8. SWOT Analysis */}
                <section className={`glass-card ${styles.mentorCard} ${styles.fullWidth}`}>
                  <h3>8. SWOT Analysis</h3>
                  <div className={styles.swotGridSimple}>
                    <div className={styles.swotBox}><strong>Strengths:</strong> {asst.swot_analysis?.strengths?.join(", ")}</div>
                    <div className={styles.swotBox}><strong>Weaknesses:</strong> {asst.swot_analysis?.weaknesses?.join(", ")}</div>
                    <div className={styles.swotBox}><strong>Opportunities:</strong> {asst.swot_analysis?.opportunities?.join(", ")}</div>
                    <div className={styles.swotBox}><strong>Threats:</strong> {asst.swot_analysis?.threats?.join(", ")}</div>
                  </div>
                </section>

                {/* 9. Improvement Suggestions */}
                <section className={`glass-card ${styles.mentorCard} ${styles.fullWidth}`}>
                  <h3>9. Improvement Suggestions</h3>
                  <div className={styles.improveGrid}>
                    <div><strong>Niche:</strong> {asst.improvement_suggestions?.niche_targeting}</div>
                    <div><strong>Innovation:</strong> {asst.improvement_suggestions?.innovation}</div>
                    <div><strong>Features:</strong> {asst.improvement_suggestions?.feature_enhancements?.join(", ")}</div>
                  </div>
                </section>

                {/* 11. Impact & Mentor Alignment */}
                <section className={`glass-card ${styles.mentorCard} ${styles.fullWidth}`}>
                  <h3>11. Impact & Mentor Alignment</h3>
                  <div className={styles.sdgHighlight}>
                    <div className={styles.sdgTags}>
                      {sdg.sdg_tags?.map((tag: string) => <span key={tag} className="badge badge-green">{tag}</span>)}
                    </div>
                    <p><strong>Social Impact:</strong> {sdg.explanation}</p>
                    <p><strong>AI Usage:</strong> {sdg.ai_meaningful_usage}</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="animate-fade-in">
            <div className="grid-2">
              {/* Critic Results */}
              <div className={`glass-card ${styles.section}`}>
                <h3>🔍 Critic Agent Findings</h3>
                {(critic.assumptions_challenged as string[] || []).length > 0 && (
                  <div>
                    <h4 className={styles.subHeading}>Challenged Assumptions</h4>
                    <ul className={styles.list}>
                      {(critic.assumptions_challenged as string[]).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(critic.critical_risks as unknown[] || []).length > 0 && (
                  <div style={{ marginTop: "20px" }}>
                    <h4 className={styles.subHeading}>Critical Risks</h4>
                    {(critic.critical_risks as Array<{ risk: string; severity: string; mitigation: string }>).map((r, i) => (
                      <div key={i} className={styles.riskItem}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <span style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{r.risk}</span>
                          <span className={`badge badge-${r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "green"}`}>
                            {r.severity}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", marginTop: "6px" }}>{r.mitigation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Market Snapshot */}
              <div className={`glass-card ${styles.section}`}>
                <h3>🌐 Market Snapshot</h3>
                <div className={styles.marketBars}>
                  <MarketBar label="TAM" value={100} formatted={(metrics.tam_formatted as string) || "$0"} color="#7c3aed" />
                  <MarketBar label="SAM" value={60} formatted={(metrics.sam_formatted as string) || "$0"} color="#06b6d4" />
                  <MarketBar label="SOM (Target)" value={20} formatted={(metrics.som_formatted as string) || "$0"} color="#10b981" />
                </div>
                <div className={styles.whyNow} style={{ marginTop: "20px" }}>
                  <h4 className={styles.subHeading}>Why Now?</h4>
                  <p style={{ fontSize: "0.9rem" }}>
                    {((market.why_now_signal as Record<string, unknown>)?.summary as string) || "Market timing analysis available in the Market tab."}
                  </p>
                </div>
              </div>
            </div>

            {/* Blue Ocean */}
            {blueOcean.create && (
              <div className={`glass-card ${styles.section} ${styles.blueOceanCard}`} style={{ marginTop: "24px" }}>
                <h3>🌊 Blue Ocean Positioning</h3>
                <p style={{ marginBottom: "20px" }}>{competitors.positioning_recommendation as string || ""}</p>
                <div className="grid-2">
                  {["eliminate", "reduce", "raise", "create"].map((action) => (
                    <div key={action} className={styles.boqItem}>
                      <h4 className={styles.subHeading} style={{ textTransform: "capitalize" }}>
                        {action === "create" ? "🚀 Create" : action === "raise" ? "⬆️ Raise" : action === "reduce" ? "⬇️ Reduce" : "❌ Eliminate"}
                      </h4>
                      <ul className={styles.list}>
                        {((blueOcean[action] as string[]) || []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Market Tab ── */}
        {activeTab === "market" && (
          <div className={styles.tabContent}>
            <div className="grid-2">
              <div className={`glass-card ${styles.section}`}>
                <h3>📈 Market Size Analysis</h3>
                <div className={styles.marketBars}>
                  <MarketBar label="Total Addressable Market (TAM)" value={100} formatted={(metrics.tam_formatted as string) || "$0"} color="#7c3aed" />
                  <MarketBar label="Serviceable Addressable Market (SAM)" value={60} formatted={(metrics.sam_formatted as string) || "$0"} color="#06b6d4" />
                  <MarketBar label="Serviceable Obtainable Market (SOM)" value={20} formatted={(metrics.som_formatted as string) || "$0"} color="#10b981" />
                </div>
                <p style={{ fontSize: "0.8rem", marginTop: "16px" }}>
                  {((market.market_size as Record<string, unknown>)?.tam_reasoning as string) || ""}
                </p>
              </div>
              <div className={`glass-card ${styles.section}`}>
                <h3>📡 Demand Signal</h3>
                <div className={styles.signalScore}>
                  <span className={styles.bigNumber}>{((market.overall_demand_signal as number) || 50).toFixed(0)}</span>
                  <span className={styles.bigNumberLabel}>/100</span>
                </div>
                <h4 className={styles.subHeading} style={{ marginTop: "16px" }}>Why Now Signals</h4>
                <ul className={styles.list}>
                  {(((market.why_now_signal as Record<string, unknown>)?.signals as string[]) || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <h4 className={styles.subHeading} style={{ marginTop: "16px" }}>Trending Keywords</h4>
                <div className={styles.tags}>
                  {(((market.search_demand as Record<string, unknown>)?.trending_keywords as string[]) || []).map((k, i) => (
                    <span key={i} className={styles.tag}>{k}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className={`glass-card ${styles.section}`} style={{ marginTop: "24px" }}>
              <h3>💬 Community Sentiment</h3>
              <div className="grid-2">
                <div>
                  <h4 className={styles.subHeading}>Real Pain Point Quotes</h4>
                  {(((market.community_sentiment as Record<string, unknown>)?.pain_quotes as string[]) || []).map((q, i) => (
                    <blockquote key={i} className={styles.quote}>&ldquo;{q}&rdquo;</blockquote>
                  ))}
                </div>
                <div>
                  <h4 className={styles.subHeading}>Market Trends</h4>
                  <div style={{ marginBottom: "12px" }}>
                    <span className={`badge badge-${((market.market_trends as Record<string, unknown>)?.direction as string) === "growing" ? "green" : "amber"}`}>
                      {((market.market_trends as Record<string, unknown>)?.direction as string) || "Unknown"} market
                    </span>
                  </div>
                  <ul className={styles.list}>
                    {(((market.market_trends as Record<string, unknown>)?.growth_drivers as string[]) || []).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Competitors Tab ── */}
        {activeTab === "competitors" && (
          <div className={styles.tabContent}>
            {directCompetitors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {(directCompetitors as Array<Record<string, unknown>>).map((c, i) => (
                  <div key={i} className={`glass-card ${styles.section}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3>{c.name as string}</h3>
                        <p style={{ fontSize: "0.9rem", marginTop: "4px" }}>{c.description as string}</p>
                      </div>
                      <span className="badge badge-amber">{c.pricing as string}</span>
                    </div>
                    <div className="grid-2" style={{ marginTop: "20px" }}>
                      <div>
                        <h4 className={styles.subHeading}>✅ Strengths</h4>
                        <ul className={styles.list}>
                          {((c.strengths as string[]) || []).map((s, j) => <li key={j}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className={styles.subHeading}>❌ Weaknesses (3-Star Gaps)</h4>
                        <ul className={styles.list}>
                          {((c.review_gaps as string[]) || []).map((g, j) => <li key={j} style={{ color: "var(--danger)" }}>{g}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`glass-card ${styles.section}`}>
                <p>Competitor data not available. Run a full validation to see competitive analysis.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Financial Tab ── */}
        {activeTab === "financial" && (
          <div className={styles.tabContent}>
            <div className="grid-3">
              {[
                { label: "TAM", value: (metrics.tam_formatted as string) || "$0", color: "#7c3aed" },
                { label: "SAM", value: (metrics.sam_formatted as string) || "$0", color: "#06b6d4" },
                { label: "SOM", value: (metrics.som_formatted as string) || "$0", color: "#10b981" },
              ].map((m) => (
                <div key={m.label} className={`glass-card ${styles.statCard}`}>
                  <span className={styles.statLabel}>{m.label}</span>
                  <span className={styles.statValue} style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
            {(financial.llm_financial_model as Record<string, unknown>) && (
              <div className={`glass-card ${styles.section}`} style={{ marginTop: "24px" }}>
                <h3>📈 3-Year Projections</h3>
                <div className="grid-3" style={{ marginTop: "16px" }}>
                  {["year1_projection", "year2_projection", "year3_projection"].map((yr, i) => {
                    const model = financial.llm_financial_model as Record<string, unknown>;
                    const proj = (model?.[yr] as Record<string, unknown>) || {};
                    return (
                      <div key={yr} className={styles.yearCard}>
                        <h4 className={styles.subHeading}>Year {i + 1}</h4>
                        <div className={styles.projStat}>
                          <span>Customers</span>
                          <span>{((proj.customers as number) || 0).toLocaleString()}</span>
                        </div>
                        <div className={styles.projStat}>
                          <span>Revenue</span>
                          <span style={{ color: "#10b981" }}>${((proj.revenue as number) || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Assets Tab ── */}
        {activeTab === "assets" && (
          <div className={styles.tabContent}>
            <div className="grid-2">
              {/* Brand Identity */}
              <div className={`glass-card ${styles.section}`}>
                <h3>🎨 Brand Identity</h3>
                <div className={styles.archetype}>
                  <span className={styles.archetypeLabel}>Brand Archetype</span>
                  <span className={styles.archetypeName}>{(brandIdentity.archetype as string) || "The Creator"}</span>
                  <p style={{ fontSize: "0.85rem" }}>{(brandIdentity.archetype_reasoning as string) || ""}</p>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Color Palette</h4>
                  <div className={styles.colorPalette}>
                    {((brandIdentity.color_palette as string[]) || []).map((c, i) => (
                      <div key={i} className={styles.colorSwatch} style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Tagline Suggestion</h4>
                  <p className={styles.tagline}>&ldquo;{(brandIdentity.tagline as string) || ""}&rdquo;</p>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Name Ideas</h4>
                  <div className={styles.tags}>
                    {((brandIdentity.brand_name_suggestions as string[]) || []).map((n, i) => (
                      <span key={i} className={styles.tag}>{n}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Business Plan */}
              <div className={`glass-card ${styles.section}`}>
                <h3>📄 Business Plan Highlights</h3>
                <div>
                  <h4 className={styles.subHeading}>Value Proposition</h4>
                  <p style={{ fontSize: "0.9rem" }}>{(businessPlan.value_proposition as string) || ""}</p>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Recommended Business Model</h4>
                  <span className="badge badge-green">{(businessPlan.business_model as string) || ""}</span>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Revenue Streams</h4>
                  <ul className={styles.list}>
                    {((businessPlan.revenue_streams as string[]) || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <h4 className={styles.subHeading}>Go-to-Market: Phase 1 (90 Days)</h4>
                  <p style={{ fontSize: "0.85rem" }}>{((businessPlan.go_to_market_strategy as Record<string, string>)?.phase1) || ""}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SDG Tab (NEW) ── */}
        {activeTab === "sdg" && (
          <div className={styles.tabContent}>
            <div className={`glass-card ${styles.section}`}>
              <h3>🌍 UN Sustainable Development Goals Impact</h3>
              <div className={styles.sdgHero}>
                <div className={styles.sdgScoreCircle}>
                  <span>{(sdg.score as number) || 0}</span>
                  <p>SDG Impact Score</p>
                </div>
                <div className={styles.sdgInfo}>
                  <p className={styles.sdgExplanation}>{(sdg.explanation as string) || ""}</p>
                  <div className={styles.sdgTags}>
                    {((sdg.sdg_tags as string[]) || []).map((tag, i) => (
                      <span key={i} className={styles.sdgTag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pivots Tab (NEW) ── */}
        {activeTab === "pivots" && (
          <div className={styles.tabContent}>
            <h3>🔄 Strategic Pivot Suggestions</h3>
            <p style={{ marginBottom: "24px", color: "var(--text-muted)" }}>
              Based on your current viability score, we recommend these alternative directions.
            </p>
            {pivots.length > 0 ? (
              <div className="grid-3">
                {(pivots as Array<Record<string, any>>).map((p, i) => (
                  <div key={i} className={`glass-card ${styles.pivotCard}`}>
                    <div className={styles.pivotHeader}>
                      <h4>{p.pivotTitle}</h4>
                      <span className="badge badge-green">{p.estimatedScore}% Est. Score</span>
                    </div>
                    <p className={styles.pivotDesc}>{p.description}</p>
                    <div className={styles.pivotMeta}>
                      <div><strong>Target:</strong> {p.targetAudience}</div>
                      <div><strong>Advantage:</strong> {p.whyBetter}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`glass-card ${styles.section}`}>
                <p>No pivots generated. This usually means your current idea is strong enough (Score &gt; 65)!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
