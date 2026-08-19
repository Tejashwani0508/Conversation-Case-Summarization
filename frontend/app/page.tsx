'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { listCases, listCustomers, getCaseAnalyses } from '../services/api';
import type { Case } from '../types/case-types';
import type { Customer } from '../types/customer-types';
import type { AIAnalysis } from '../types/ai-types';
import { CasePriority, CaseStatus, Sentiment } from '../types/enums';

const RECENT_CASES_LIMIT = 10;

interface CaseStats {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  highPriority: number;
  criticalPriority: number;
}

export default function Home() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The backend caps page_size at 100, so use the status filter with a
      // minimal page and read the `total` field for accurate counts.
      const [totalRes, openRes, pendingRes, resolvedRes, highRes, criticalRes, recentRes, custRes] =
        await Promise.all([
          listCases({ page: 1, page_size: 1 }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.OPEN }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.IN_PROGRESS }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.RESOLVED }),
          listCases({ page: 1, page_size: 1, priority: CasePriority.HIGH }),
          listCases({ page: 1, page_size: 1, priority: CasePriority.CRITICAL }),
          listCases({ page: 1, page_size: RECENT_CASES_LIMIT }),
          listCustomers({ page: 1, page_size: 100 }),
        ]);

      setStats({
        total: totalRes.total,
        open: openRes.total,
        pending: pendingRes.total,
        resolved: resolvedRes.total,
        highPriority: highRes.total,
        criticalPriority: criticalRes.total,
      });
      setRecentCases(recentRes.items);

      const map: Record<string, Customer> = {};
      for (const c of custRes.items) map[c.id] = c;
      setCustomers(map);

      // Fetch the latest AI analysis for each recent case (if any).
      const analysisMap: Record<string, AIAnalysis> = {};
      await Promise.all(
        recentRes.items.map(async (c) => {
          try {
            const res = await getCaseAnalyses(c.id, { page: 1, page_size: 1 });
            if (res.items.length > 0) {
              analysisMap[c.id] = res.items[0];
            }
          } catch {
            // Per-case analysis errors are non-fatal; treat as "no analysis".
          }
        }),
      );
      setAnalyses(analysisMap);
    } catch {
      setError('Unable to load dashboard data. Please check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const aiAnalyzedCount = Object.keys(analyses).length;
  const highPriorityCount = (stats?.highPriority ?? 0) + (stats?.criticalPriority ?? 0);

  // Latest AI analysis across all recent cases (backend orders by created_at DESC).
  const latestAnalysis = useMemo(() => {
    const entries = Object.values(analyses);
    if (entries.length === 0) return null;
    return entries.reduce((latest, a) =>
      new Date(a.created_at) > new Date(latest.created_at) ? a : latest,
    );
  }, [analyses]);

  const latestAnalysisCase = latestAnalysis
    ? recentCases.find((c) => c.id === latestAnalysis.case_id) ?? null
    : null;

  // Cases with AI analysis, sorted by analysis created_at DESC.
  const analyzedCases = useMemo(() => {
    return recentCases
      .filter((c) => analyses[c.id])
      .sort((a, b) => {
        const ta = new Date(analyses[a.id].created_at).getTime();
        const tb = new Date(analyses[b.id].created_at).getTime();
        return tb - ta;
      });
  }, [recentCases, analyses]);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ─── Top Navigation ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Conversation Intelligence</p>
              <p className="text-xs text-slate-500">AI-powered customer service intelligence</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
            >
              Dashboard
            </Link>
            <Link
              href="/cases"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Cases
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ─── Hero / Page Header ───────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            AI Conversation Intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            Turn customer conversations into actionable case insights with AI-powered summaries.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/cases"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              View Cases
            </Link>
            {latestAnalysis && (
              <a
                href="#ai-insights"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Recent AI Analyses
              </a>
            )}
          </div>
        </div>

        {/* ─── Error state ──────────────────────────────────────────────── */}
        {error && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              onClick={() => void loadDashboard()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ─── KPI / Insight Cards ──────────────────────────────────── */}
            {stats && (
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Cases"
                  value={stats.total}
                  description="All customer cases"
                  icon={<FolderIcon className="h-5 w-5" />}
                  iconClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                  label="AI Analyses"
                  value={aiAnalyzedCount}
                  description="Cases analyzed by AI"
                  icon={<SparklesIcon className="h-5 w-5" />}
                  iconClass="bg-violet-50 text-violet-600"
                />
                <StatCard
                  label="High Priority"
                  value={highPriorityCount}
                  description="HIGH or CRITICAL cases"
                  icon={<AlertIcon className="h-5 w-5" />}
                  iconClass="bg-red-50 text-red-600"
                />
                <StatCard
                  label="Resolved Cases"
                  value={stats.resolved}
                  description="Cases resolved"
                  icon={<CheckCircleIcon className="h-5 w-5" />}
                  iconClass="bg-emerald-50 text-emerald-600"
                />
              </div>
            )}

            {/* ─── Latest AI Summary ────────────────────────────────────── */}
            {latestAnalysis && latestAnalysisCase && (
              <section className="mb-8 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
                <div className="border-b border-blue-100 bg-blue-50/60 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-slate-900">Latest AI Summary</h2>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(latestAnalysis.created_at)}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <p className="font-mono text-xs font-medium text-blue-600">
                      {latestAnalysisCase.case_number}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {latestAnalysisCase.subject}
                    </h3>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Summary
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{latestAnalysis.summary}</p>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge className={sentimentBadge(latestAnalysis.sentiment)}>
                      {latestAnalysis.sentiment}
                    </Badge>
                    <Badge className={priorityBadge(latestAnalysis.ai_priority)}>
                      {latestAnalysis.ai_priority} priority
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-600">{latestAnalysis.category}</Badge>
                  </div>

                  {latestAnalysis.recommended_action && (
                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Recommended Action
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {latestAnalysis.recommended_action}
                      </p>
                    </div>
                  )}

                  <Link
                    href={`/cases/${latestAnalysis.case_id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                  >
                    View Full Case
                  </Link>
                </div>
              </section>
            )}

            {/* ─── AI Conversation Insights ─────────────────────────────── */}
            <section id="ai-insights" className="mb-8 scroll-mt-20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">AI Conversation Insights</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Quick overview of what AI has identified across recent customer conversations.
                  </p>
                </div>
                <Link href="/cases" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View all cases →
                </Link>
              </div>

              {analyzedCases.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <SparklesIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-900">No AI summaries yet</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    Generate an AI summary from a case conversation to see insights here.
                  </p>
                  <Link
                    href="/cases"
                    className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    View Cases
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {analyzedCases.map((c) => {
                    const analysis = analyses[c.id];
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-medium text-blue-600">
                              {c.case_number}
                            </p>
                            <h3 className="mt-1 font-semibold text-slate-900">{c.subject}</h3>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatDate(analysis.created_at)}
                          </span>
                        </div>

                        <div className="mb-3 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            AI Summary
                          </p>
                          <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-700">
                            {analysis.summary}
                          </p>
                        </div>

                        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-500">
                            Customer: {customers[c.customer_id]?.name ?? c.customer_id}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500">Category: {c.category}</span>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          <Badge className={sentimentBadge(analysis.sentiment)}>
                            {analysis.sentiment}
                          </Badge>
                          <Badge className={priorityBadge(analysis.ai_priority)}>
                            {analysis.ai_priority}
                          </Badge>
                        </div>

                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          View AI Analysis
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─── Recent Cases ─────────────────────────────────────────── */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Recent Cases</h2>
                <Link href="/cases" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View all →
                </Link>
              </div>

              {recentCases.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <FolderIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-900">No customer cases yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Customer cases will appear here once they are created.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Case</th>
                          <th className="px-4 py-3 font-semibold">Subject</th>
                          <th className="px-4 py-3 font-semibold">Customer</th>
                          <th className="px-4 py-3 font-semibold">Category</th>
                          <th className="px-4 py-3 font-semibold">Priority</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">AI Analysis</th>
                          <th className="px-4 py-3 font-semibold">Created</th>
                          <th className="px-4 py-3 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentCases.map((c) => (
                          <tr key={c.id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">
                              {c.case_number}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{c.subject}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {customers[c.customer_id]?.name ?? c.customer_id}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{c.category}</td>
                            <td className="px-4 py-3">
                              <Badge className={priorityBadge(c.priority)}>{c.priority}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={statusBadge(c.status)}>{c.status}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {analyses[c.id] ? (
                                <Badge className="bg-emerald-50 text-emerald-700">Available</Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500">Not generated</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/cases/${c.id}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                View Case
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* KPI skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Latest AI summary skeleton */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
        <div className="mb-3 h-4 w-28 rounded bg-slate-100" />
        <div className="mb-4 h-6 w-3/4 rounded bg-slate-200" />
        <div className="mb-4 h-20 rounded-xl bg-slate-100" />
        <div className="mb-4 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-slate-200" />
          <div className="h-6 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-slate-200" />
      </div>

      {/* AI insights skeleton */}
      <div className="mb-8">
        <div className="mb-4 h-6 w-56 rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
              <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
              <div className="mb-3 h-16 rounded-xl bg-slate-100" />
              <div className="mb-3 h-4 w-40 rounded bg-slate-100" />
              <div className="mb-4 flex gap-2">
                <div className="h-6 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="h-9 w-full rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent cases skeleton */}
      <div>
        <div className="mb-4 h-6 w-40 rounded bg-slate-200" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="h-3 w-40 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-5 w-24 rounded-full bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="h-7 w-20 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badge helpers ──────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case CaseStatus.OPEN:
      return 'bg-emerald-50 text-emerald-700';
    case CaseStatus.IN_PROGRESS:
      return 'bg-amber-50 text-amber-700';
    case CaseStatus.RESOLVED:
      return 'bg-blue-50 text-blue-700';
    case CaseStatus.CLOSED:
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case CasePriority.LOW:
      return 'bg-emerald-50 text-emerald-700';
    case CasePriority.MEDIUM:
      return 'bg-amber-50 text-amber-700';
    case CasePriority.HIGH:
      return 'bg-orange-50 text-orange-700';
    case CasePriority.CRITICAL:
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function sentimentBadge(sentiment: string) {
  switch (sentiment) {
    case Sentiment.POSITIVE:
      return 'bg-emerald-50 text-emerald-700';
    case Sentiment.NEUTRAL:
      return 'bg-slate-100 text-slate-600';
    case Sentiment.CONCERNED:
      return 'bg-amber-50 text-amber-700';
    case Sentiment.FRUSTRATED:
      return 'bg-orange-50 text-orange-700';
    case Sentiment.ANGRY:
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

// ─── Icons (inline SVG, no external library) ────────────────────────────────

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}