"use client";
import Link from "next/link";
import styles from "./page.module.css";

const METRICS = [
  { label: "Ideas Validated", value: "12,847", icon: "⚡" },
  { label: "Avg. Report Time", value: "94 sec", icon: "⏱️" },
  { label: "Accuracy vs Analysts", value: "87%", icon: "🎯" },
  { label: "Entrepreneurs Retained", value: "63%", icon: "🔥" },
];

const FEATURES = [
  {
    icon: "🔍",
    title: "Hypothesis Critique",
    desc: "Ruthlessly challenges your assumptions before research begins, forcing problem-first thinking.",
  },
  {
    icon: "🌐",
    title: "Live Market Signals",
    desc: "Continuously updated research surfaces trends, customer sentiment, and market size data.",
  },
  {
    icon: "⚔️",
    title: "Competitor SWOT Analysis",
    desc: "Finds 3-star review gaps in competitor offerings and generates your Blue Ocean positioning.",
  },
  {
    icon: "📊",
    title: "TAM / SAM / SOM Model",
    desc: "Bottom-up market sizing with automated financial projections for Years 1–3.",
  },
  {
    icon: "🎯",
    title: "Viability Score™",
    desc: "Weighted composite of demand signal, competitive gap, and feasibility — with RAG traffic lights.",
  },
  {
    icon: "📄",
    title: "Instant Business Plan",
    desc: "40+ page investor-ready document with go-to-market strategy and brand identity kit.",
  },
];

const SAMPLE_SCORES = [
  { name: "AI Invoice Automation for SMBs", score: 82, color: "green" },
  { name: "Peer-to-Peer Car Rental Platform", score: 56, color: "amber" },
  { name: "NFT Marketplace for Pet Photos", score: 18, color: "red" },
];

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* ── Navigation ── */}
      <nav className={styles.nav}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
            <span>ValidateAI</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#how-it-works" className={styles.navLink}>How It Works</a>
            <Link href="/validate" className="btn btn-primary btn-sm">
              Start Validating →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroBadge}>
            <span className="badge badge-green">🟢 Live</span>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Real-time validation insights
            </span>
          </div>

          <h1 className={styles.heroTitle}>
            Validate Your Startup Idea<br />
            <span className="gradient-text">In Under 10 Minutes</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Replace weeks of manual research with an autonomous workflow that
            conduct real-time market analysis, competitive intelligence, and
            financial modeling — delivering an investor-ready report instantly.
          </p>

          <div className={styles.heroCta}>
            <Link href="/validate" className="btn btn-primary btn-lg animate-pulse-glow">
              🚀 Validate My Idea — Free
            </Link>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See How It Works
            </button>
          </div>

          {/* Sample Viability Scores */}
          <div className={styles.sampleScores}>
            {SAMPLE_SCORES.map((s) => (
              <div key={s.name} className={`glass-card ${styles.sampleScore}`}>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreBarFill}
                    style={{
                      width: `${s.score}%`,
                      background: s.color === "green"
                        ? "linear-gradient(90deg, #10b981, #059669)"
                        : s.color === "amber"
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : "linear-gradient(90deg, #ef4444, #dc2626)",
                    }}
                  />
                </div>
                <div className={styles.scoreInfo}>
                  <span className={styles.scoreName}>{s.name}</span>
                  <span className={`badge badge-${s.color}`}>{s.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Metrics Strip ── */}
      <section className={styles.metrics}>
        <div className="container">
          <div className={styles.metricsGrid}>
            {METRICS.map((m) => (
              <div key={m.label} className={styles.metricItem}>
                <span className={styles.metricIcon}>{m.icon}</span>
                <span className={styles.metricValue}>{m.value}</span>
                <span className={styles.metricLabel}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className={`section ${styles.features}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>Everything You Need to <span className="gradient-text">Validate & Launch</span></h2>
            <p>A coordinated validation workflow that delivers institutional-grade research in minutes.</p>
          </div>
          <div className="grid-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`glass-card ${styles.featureCard}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className={styles.featureIcon}>{f.icon}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className={`section ${styles.howItWorks}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>From Idea to <span className="gradient-text">Investor-Ready Report</span></h2>
            <p>Five coordinated stages run in sequence and parallel to validate every dimension of your idea.</p>
          </div>
          <div className={styles.steps}>
            {[
              { n: "01", title: "Define Your Hypothesis", desc: "Structured input: 'Customer X struggles with Y because Z'", icon: "✏️" },
              { n: "02", title: "Structured Critique", desc: "The critique stage stress-tests assumptions and refines your hypothesis", icon: "🔍" },
              { n: "03", title: "Parallel Market Research", desc: "Market and competitor research stages run simultaneously", icon: "⚡" },
              { n: "04", title: "Financial Modeling", desc: "TAM/SAM/SOM calculated, Viability Score computed, 3-year projections built", icon: "📊" },
              { n: "05", title: "Assets Generated", desc: "Business plan, brand kit, and marketing sequences created automatically", icon: "📄" },
            ].map((step, i) => (
              <div key={step.n} className={styles.step}>
                <div className={styles.stepNumber}>{step.n}</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{step.icon} {step.title}</h3>
                  <p>{step.desc}</p>
                </div>
                {i < 4 && <div className={styles.stepConnector} aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={`glass-card ${styles.ctaCard}`}>
            <h2>Ready to Validate Your Next Big Idea?</h2>
            <p>Join thousands of entrepreneurs who validated before building. Save months of wasted effort.</p>
            <Link href="/validate" className="btn btn-primary btn-lg">
              🚀 Start Free Validation
            </Link>
            <p className={styles.ctaNote}>No signup required · Results in &lt; 120 seconds</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>⚡</span>
              <span>ValidateAI</span>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Continuous research and validation insights
              </p>
              <Link href="/admin" className="btn btn-secondary btn-sm">
                KPI Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
