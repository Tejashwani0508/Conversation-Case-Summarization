'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  AppHeader,
  Badge,
  EmptyState,
  priorityBadge,
  sentimentBadge,
  SparklesIcon,
  statusBadge,
} from '../../components/dashboard';
import { getCaseAnalyses, listCases, listCustomers, type ApiError } from '../../services/api';
import type { AIAnalysis } from '../../types/ai-types';
import type { Case } from '../../types/case-types';
import type { Customer } from '../../types/customer-types';
import { CaseStatus } from '../../types/enums';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ['', ...Object.values(CaseStatus)];

type SummaryEntry = {
  caseData: Case;
  customerName: string;
  analysis: AIAnalysis;
};

export default function AISummariesPage() {
  const [entries, setEntries] = useState<SummaryEntry[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caseRes, customerRes] = await Promise.all([
        listCases({ page: 1, page_size: 100 }),
        listCustomers({ page: 1, page_size: 100 }),
      ]);

      const map: Record<string, Customer> = {};
      for (const customer of customerRes.items) {
        map[customer.id] = customer;
      }
      setCustomers(map);

      const allEntries: SummaryEntry[] = [];

      await Promise.all(
        caseRes.items.map(async (caseItem) => {
          try {
            const analysisRes = await getCaseAnalyses(caseItem.id, { page: 1, page_size: 20 });
            for (const analysis of analysisRes.items) {
              allEntries.push({
                caseData: caseItem,
                customerName: map[caseItem.customer_id]?.name ?? caseItem.customer_id,
                analysis,
              });
            }
          } catch {
            // Per-case analysis failures are non-fatal for the summaries overview.
          }
        }),
      );

      setEntries(
        allEntries.sort((a, b) => new Date(b.analysis.created_at).getTime() - new Date(a.analysis.created_at).getTime()),
      );
    } catch {
      setError('Unable to load AI summaries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      const matchesSearch =
        !query ||
        entry.caseData.case_number.toLowerCase().includes(query) ||
        entry.caseData.subject.toLowerCase().includes(query) ||
        entry.analysis.summary.toLowerCase().includes(query);

      const matchesStatus = !status || entry.caseData.status === status;
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'oldest') {
        return new Date(a.analysis.created_at).getTime() - new Date(b.analysis.created_at).getTime();
      }

      if (sort === 'priority') {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
        return order[b.analysis.ai_priority] - order[a.analysis.ai_priority];
      }

      return new Date(b.analysis.created_at).getTime() - new Date(a.analysis.created_at).getTime();
    });

    return sorted;
  }, [entries, search, sort, status]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, status, sort, pageSize]);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader active="ai-summaries" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">AI Summary Library</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">AI Summaries</h1>
          </div>
          <Link href="/" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </header>

        <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search summaries..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:bg-white"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option || 'all'} value={option}>
                {option ? `Status: ${option}` : 'All statuses'}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'priority')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Priority</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
          >
            {[10, 20, 30].map((size) => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={() => void loadSummaries()}
              className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
                <div className="mb-2 h-5 w-44 rounded bg-slate-200" />
                <div className="h-20 rounded-xl bg-slate-100" />
                <div className="mt-4 h-4 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : paginatedEntries.length === 0 ? (
          <EmptyState
            title="No AI summaries yet"
            description="Generate an AI summary from a case to see AI-powered insights here."
            actionLabel="View Cases"
            actionHref="/cases"
            icon={<SparklesIcon className="h-5 w-5" />}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedEntries.map(({ analysis, caseData, customerName }) => (
                <article key={`${caseData.id}-${analysis.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                        {caseData.case_number}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">{caseData.subject}</h2>
                    </div>
                    <span className="text-[11px] text-slate-400">{new Date(analysis.created_at).toLocaleDateString()}</span>
                  </div>

                  <p className="text-sm leading-6 text-slate-600">{analysis.summary}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Customer: {customerName}</span>
                    <span>•</span>
                    <span>{caseData.status}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className={sentimentBadge(analysis.sentiment)}>{analysis.sentiment}</Badge>
                    <Badge className={priorityBadge(analysis.ai_priority)}>{analysis.ai_priority}</Badge>
                    <Badge className={statusBadge(caseData.status)}>{caseData.status}</Badge>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Link href={`/cases/${caseData.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
                      View Summary <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
