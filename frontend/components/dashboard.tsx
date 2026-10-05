'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AIAnalysis } from '../types/ai-types';
import type { Case } from '../types/case-types';
import type { Customer } from '../types/customer-types';
import { CasePriority, CaseStatus, Sentiment } from '../types/enums';

export type DashboardSummaryItem = {
  analysis: AIAnalysis;
  caseData: Case;
  customerName: string;
};

export function AppHeader({ active }: { active: 'dashboard' | 'cases' | 'ai-summaries' | 'customers' }) {
  const navItems = [
    { label: 'Dashboard', href: '/', key: 'dashboard' },
    { label: 'Cases', href: '/cases', key: 'cases' },
    { label: 'AI Summaries', href: '/ai-summaries', key: 'ai-summaries' },
    { label: 'Customers', href: '/customers', key: 'customers' },
  ] as const;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Conversation Intelligence</p>
            <p className="text-[11px] text-slate-500">AI-powered customer service intelligence</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
          {navItems.map(({ label, href, key }) => {
            const selected = active === key;
            return (
              <Link
                key={key}
                href={href}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-medium transition',
                  selected
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900',
                ].join(' ')}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accentClass,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-8 w-16 rounded bg-slate-200" />
              </div>
              <div className="h-11 w-11 rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 h-4 w-24 rounded bg-slate-200" />
            <div className="mb-2 h-5 w-32 rounded bg-slate-200" />
            <div className="h-20 rounded-xl bg-slate-100" />
            <div className="mt-4 h-4 w-40 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 h-5 w-32 rounded bg-slate-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AISummaryCard({
  item,
}: {
  item: DashboardSummaryItem;
}) {
  const summaryPreview = summarizePreview(item.analysis.summary);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 transition hover:border-blue-200 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            {item.caseData.case_number}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">{item.caseData.subject}</h3>
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">{formatDate(item.analysis.created_at)}</span>
      </div>

      <p className="flex-1 text-sm leading-6 text-slate-600">{summaryPreview}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className={sentimentBadge(item.analysis.sentiment)}>{item.analysis.sentiment}</Badge>
        <Badge className={priorityBadge(item.analysis.ai_priority)}>{item.analysis.ai_priority}</Badge>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <Link
          href={`/cases/${item.caseData.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 transition hover:text-blue-800"
        >
          View Summary <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export function RecentCasesTable({
  cases,
  customers,
  analyses,
}: {
  cases: Case[];
  customers: Record<string, Customer>;
  analyses: Record<string, AIAnalysis>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">AI Analysis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((caseItem) => {
              const analysis = analyses[caseItem.id];
              const customerName = customers[caseItem.customer_id]?.name ?? caseItem.customer_id;
              return (
                <tr key={caseItem.id} className="align-top transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">
                    <Link href={`/cases/${caseItem.id}`} className="hover:text-blue-700">
                      {caseItem.case_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{caseItem.subject}</td>
                  <td className="px-4 py-3 text-slate-600">{customerName}</td>
                  <td className="px-4 py-3">
                    <Badge className={priorityBadge(caseItem.priority)}>{caseItem.priority}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusBadge(caseItem.status)}>{caseItem.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {analysis ? (
                      <Link href={`/cases/${caseItem.id}`} className="text-xs font-medium text-blue-700 hover:text-blue-800">
                        View summary
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Not generated</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </div>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>{children}</span>;
}

export function SparklesIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M3.75 7.5A2.25 2.25 0 0 1 6 5.25h4.5l1.5 2.25H18A2.25 2.25 0 0 1 20.25 9.75v6.75A2.25 2.25 0 0 1 18 18.75H6A2.25 2.25 0 0 1 3.75 16.5V7.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M12 9v4.5m0 3.75h.01M10.49 3.83 2.96 17.38A1.5 1.5 0 0 0 4.47 19.5h15.06a1.5 1.5 0 0 0 1.51-2.12L13.51 3.83a1.5 1.5 0 0 0-2.52 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M9 12.75 11.25 15l3.75-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function statusBadge(status: string) {
  switch (status) {
    case CaseStatus.OPEN:
      return 'bg-emerald-50 text-emerald-700';
    case CaseStatus.IN_PROGRESS:
      return 'bg-amber-50 text-amber-700';
    case CaseStatus.RESOLVED:
      return 'bg-blue-50 text-blue-700';
    case CaseStatus.CLOSED:
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function priorityBadge(priority: string) {
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

export function sentimentBadge(sentiment: string) {
  switch (sentiment) {
    case Sentiment.POSITIVE:
      return 'bg-emerald-50 text-emerald-700';
    case Sentiment.NEUTRAL:
      return 'bg-slate-100 text-slate-700';
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

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function summarizePreview(summary: string) {
  const trimmed = summary.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157).trimEnd()}...`;
}
