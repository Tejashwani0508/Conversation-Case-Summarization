'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  AISummaryCard,
  AlertIcon,
  AppHeader,
  CheckCircleIcon,
  DashboardSkeleton,
  EmptyState,
  FolderIcon,
  RecentCasesTable,
  SparklesIcon,
  StatCard,
} from '../components/dashboard';
import type { DashboardSummaryItem } from '../components/dashboard';
import { getCase, getCustomer, listAIAnalyses, listCases, listCustomers } from '../services/api';
import type { AIAnalysis } from '../types/ai-types';
import type { Case } from '../types/case-types';
import type { Customer } from '../types/customer-types';
import { CasePriority, CaseStatus } from '../types/enums';

const RECENT_CASES_LIMIT = 5;
const SUMMARY_CARD_LIMIT = 3;

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
  const [summaryItems, setSummaryItems] = useState<DashboardSummaryItem[]>([]);
  const [summaryCount, setSummaryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [allRes, openRes, pendingRes, resolvedRes, highRes, criticalRes, recentRes, customerRes, summaryRes] =
        await Promise.all([
          listCases({ page: 1, page_size: 100 }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.OPEN }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.IN_PROGRESS }),
          listCases({ page: 1, page_size: 1, status: CaseStatus.RESOLVED }),
          listCases({ page: 1, page_size: 1, priority: CasePriority.HIGH }),
          listCases({ page: 1, page_size: 1, priority: CasePriority.CRITICAL }),
          listCases({ page: 1, page_size: RECENT_CASES_LIMIT }),
          listCustomers({ page: 1, page_size: 100 }),
          listAIAnalyses({ page: 1, page_size: SUMMARY_CARD_LIMIT }),
        ]);

      const customerMap: Record<string, Customer> = {};
      for (const customer of customerRes.items) {
        customerMap[customer.id] = customer;
      }
      setCustomers(customerMap);

      setStats({
        total: allRes.total,
        open: openRes.total,
        pending: pendingRes.total,
        resolved: resolvedRes.total,
        highPriority: highRes.total,
        criticalPriority: criticalRes.total,
      });
      setRecentCases(recentRes.items.slice(0, RECENT_CASES_LIMIT));
      setSummaryCount(summaryRes.total);

      const casesById = new Map(allRes.items.map((caseItem) => [caseItem.id, caseItem]));
      const summaries = await Promise.all(
        summaryRes.items.map(async (analysis) => {
          try {
            const caseItem = casesById.get(analysis.case_id) ?? await getCase(analysis.case_id);
            const customerName = customerMap[caseItem.customer_id]?.name
              ?? (await getCustomer(caseItem.customer_id)).name;

            return {
              analysis,
              caseData: caseItem,
              customerName,
            };
          } catch {
            return null;
          }
        }),
      );

      setSummaryItems(summaries.filter((item): item is DashboardSummaryItem => item !== null));
    } catch {
      setError('Unable to load dashboard data. Please check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const highPriorityCount = (stats?.highPriority ?? 0) + (stats?.criticalPriority ?? 0);

  const recentCaseAnalyses = useMemo<Record<string, AIAnalysis>>(() => {
    const analysisMap: Record<string, AIAnalysis> = {};
    recentCases.forEach((caseItem) => {
      const summary = summaryItems.find((item) => item.caseData.id === caseItem.id);
      if (summary) {
        analysisMap[caseItem.id] = summary.analysis;
      }
    });
    return analysisMap;
  }, [recentCases, summaryItems]);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader active="dashboard" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
              Overview
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              AI Conversation Intelligence
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              Track live case activity, AI-generated summaries, and the most urgent customer issues in one streamlined view.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/cases"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              View Cases
            </Link>
            <Link
              href="/ai-summaries"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              AI Summaries
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
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
          stats && (
            <>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Cases"
                  value={stats.total}
                  icon={<FolderIcon className="h-5 w-5" />}
                  accentClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                  label="AI Summaries"
                  value={summaryCount}
                  icon={<SparklesIcon className="h-5 w-5" />}
                  accentClass="bg-violet-50 text-violet-600"
                />
                <StatCard
                  label="High Priority"
                  value={highPriorityCount}
                  icon={<AlertIcon className="h-5 w-5" />}
                  accentClass="bg-red-50 text-red-600"
                />
                <StatCard
                  label="Resolved Cases"
                  value={stats.resolved}
                  icon={<CheckCircleIcon className="h-5 w-5" />}
                  accentClass="bg-emerald-50 text-emerald-600"
                />
              </div>

              <section className="mb-8">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">
                      Insight Preview
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">Recent AI Summaries</h2>
                  </div>
                  <Link href="/ai-summaries" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    View all summaries →
                  </Link>
                </div>

                {summaryItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {summaryItems.map((item) => (
                      <AISummaryCard key={item.analysis.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No AI summaries yet"
                    description="Recent AI-generated summaries will appear here as cases are analyzed."
                    actionLabel="View cases"
                    actionHref="/cases"
                    icon={<SparklesIcon className="h-5 w-5" />}
                  />
                )}
              </section>

              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Work queue
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">Recent Cases</h2>
                  </div>
                  <Link href="/cases" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    View all cases →
                  </Link>
                </div>

                {recentCases.length > 0 ? (
                  <RecentCasesTable
                    cases={recentCases}
                    customers={customers}
                    analyses={recentCaseAnalyses}
                  />
                ) : (
                  <EmptyState
                    title="No customer cases yet"
                    description="Once new customer conversations are created, they will appear here."
                    actionLabel="Go to cases"
                    actionHref="/cases"
                    icon={<FolderIcon className="h-5 w-5" />}
                  />
                )}
              </section>
            </>
          )
        )}
      </div>
    </main>
  );
}
