'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { listCases, listCustomers, ApiError } from '../../services/api';
import type { Case } from '../../types/case-types';
import type { Customer } from '../../types/customer-types';
import { CasePriority, CaseStatus } from '../../types/enums';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS = ['', ...Object.values(CaseStatus)];
const PRIORITY_OPTIONS = ['', ...Object.values(CasePriority)];

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, status, priority, pageSize]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCases({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
      });
      setCases(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);

      // Fetch customer names for cases
      const customerIds = Array.from(new Set(data.items.map((c) => c.customer_id)));
      if (customerIds.length > 0) {
        const custData = await listCustomers({ page: 1, page_size: 100 });
        const map: Record<string, Customer> = {};
        for (const c of custData.items) map[c.id] = c;
        setCustomers(map);
      } else {
        setCustomers({});
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load cases.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, priority]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl p-6 lg:p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Cases</h1>
            <Link
              href="/"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
            >
              ← Home
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {total} case{total !== 1 ? 's' : ''} found
          </p>
        </header>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case number, subject, description..."
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>{s ? `Status: ${s}` : 'All Statuses'}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p || 'all'} value={p}>{p ? `Priority: ${p}` : 'All Priorities'}</option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
            Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
            No cases found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Case Number</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {cases.map((c) => (
                    <tr key={c.id} className="transition hover:bg-slate-900/60">
                      <td className="px-4 py-3 font-mono text-xs text-blue-400">{c.case_number}</td>
                      <td className="px-4 py-3 font-medium">{c.subject}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {customers[c.customer_id]?.name ?? c.customer_id}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.category}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadge(c.priority)}`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/cases/${c.id}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case CaseStatus.OPEN: return 'bg-green-900/60 text-green-300';
    case CaseStatus.IN_PROGRESS: return 'bg-amber-900/60 text-amber-300';
    case CaseStatus.RESOLVED: return 'bg-emerald-900/60 text-emerald-300';
    case CaseStatus.CLOSED: return 'bg-slate-800 text-slate-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case CasePriority.LOW: return 'bg-slate-800 text-slate-300';
    case CasePriority.MEDIUM: return 'bg-blue-900/60 text-blue-300';
    case CasePriority.HIGH: return 'bg-amber-900/60 text-amber-300';
    case CasePriority.CRITICAL: return 'bg-red-900/60 text-red-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}