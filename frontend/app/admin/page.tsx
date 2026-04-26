"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./page.module.css";

type MetricSummary = {
  window_days: number;
  event_count: number;
  counts: Record<string, number>;
  avg_dau: number;
  dau_by_day: Array<{ date: string; active_users: number }>;
  validation_completion_rate_percent: number;
};

const defaultSummary: MetricSummary = {
  window_days: 7,
  event_count: 0,
  counts: {
    validation_started: 0,
    validation_completed: 0,
    validation_failed: 0,
    report_page_view: 0,
    validate_page_view: 0,
  },
  avg_dau: 0,
  dau_by_day: [],
  validation_completion_rate_percent: 0,
};

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<MetricSummary>(defaultSummary);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthToken = async (): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const mod = await import("../../lib/firebase");
      return (await mod.auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        const token = await getAuthToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

        const response = await fetch(`${API_BASE}/api/metrics/summary?days=7`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Dashboard data is unavailable right now.");
        }

        const payload = (await response.json()) as MetricSummary;
        setSummary(payload);
      } catch (fetchError) {
        setError((fetchError as Error).message || "Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, []);

  const countsData = [
    { label: "Started", value: summary.counts.validation_started },
    { label: "Completed", value: summary.counts.validation_completed },
    { label: "Failed", value: summary.counts.validation_failed },
    { label: "Report Views", value: summary.counts.report_page_view },
    { label: "Validate Views", value: summary.counts.validate_page_view },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" className={styles.back}>⚡ ValidateAI</Link>
          <Link href="/validate" className="btn btn-secondary btn-sm">Open Validator</Link>
        </div>
      </header>

      <div className="container">
        <div className={styles.hero}>
          <span className="badge badge-green">Admin KPI Dashboard</span>
          <h1 className={styles.title}>Validation Health and Engagement</h1>
          <p className={styles.subtitle}>
            Daily active usage, validation funnel completion, and page-view engagement from the last {summary.window_days} days.
          </p>
        </div>

        {loading && <div className={`glass-card ${styles.notice}`}>Loading metrics summary...</div>}
        {error && <div className={`glass-card ${styles.error}`}>{error}</div>}

        <div className={styles.summaryGrid}>
          <div className={`glass-card ${styles.statCard}`}>
            <span className={styles.statLabel}>Avg. DAU</span>
            <span className={styles.statValue}>{summary.avg_dau.toFixed(2)}</span>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <span className={styles.statLabel}>Completion Rate</span>
            <span className={styles.statValue}>{summary.validation_completion_rate_percent.toFixed(1)}%</span>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <span className={styles.statLabel}>Events</span>
            <span className={styles.statValue}>{summary.event_count}</span>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <span className={styles.statLabel}>Started Validations</span>
            <span className={styles.statValue}>{summary.counts.validation_started}</span>
          </div>
        </div>

        <div className={styles.grid}>
          <section className={`glass-card ${styles.panel}`}>
            <h2>Daily Active Users</h2>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={summary.dau_by_day}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Line type="monotone" dataKey="active_users" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={`glass-card ${styles.panel}`}>
            <h2>Validation Funnel</h2>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={countsData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
