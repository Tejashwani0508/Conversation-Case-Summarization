'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import {
  getCase,
  getCustomer,
  getConversationHistory,
  createConversation,
  generateCaseSummary,
  getCaseAnalyses,
  getAIAnalysisRuns,
  ApiError,
} from '../../../services/api';
import type { Case } from '../../../types/case-types';
import type { Customer } from '../../../types/customer-types';
import type { Conversation } from '../../../types/conversation-types';
import type { AIAnalysis, AIAnalysisRun } from '../../../types/ai-types';
import {
  CaseCategory,
  CasePriority,
  CaseStatus,
  SenderType,
  ConversationChannel,
  Sentiment,
  AIAnalysisRunStatus,
} from '../../../types/enums';

const SENDER_OPTIONS = Object.values(SenderType);
const CHANNEL_OPTIONS = Object.values(ConversationChannel);
const ANALYSIS_PAGE_SIZE = 10;
const RUNS_PAGE_SIZE = 10;

export default function CaseDetailsPage({ params }: { params: { caseId: string } }) {
  const caseId = params.caseId;

  // Case + customer + conversations
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [loadingCase, setLoadingCase] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);

  // AI Analysis
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysis[]>([]);
  const [runHistory, setRunHistory] = useState<AIAnalysisRun[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);

  // Add conversation form state
  const [senderType, setSenderType] = useState<SenderType>(SenderType.CUSTOMER);
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<ConversationChannel>(ConversationChannel.CHAT);
  const [timestamp, setTimestamp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    setLoadingCase(true);
    setCaseError(null);
    try {
      const data = await getCase(caseId);
      setCaseData(data);

      setLoadingCustomer(true);
      try {
        const c = await getCustomer(data.customer_id);
        setCustomer(c);
      } catch {
        setCustomer(null);
      } finally {
        setLoadingCustomer(false);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setCaseError(err.message);
      } else {
        setCaseError('Failed to load case.');
      }
    } finally {
      setLoadingCase(false);
    }
  }, [caseId]);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationError(null);
    try {
      const data = await getConversationHistory(caseId);
      setConversations(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setConversationError(err.message);
      } else {
        setConversationError('Failed to load conversation history.');
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [caseId]);

  const loadAI = useCallback(async () => {
    setLoadingAnalysis(true);
    setLoadingHistory(true);
    setLoadingRuns(true);
    setAiError(null);
    try {
      const [analysisRes, runsRes] = await Promise.all([
        getCaseAnalyses(caseId, { page: 1, page_size: ANALYSIS_PAGE_SIZE }),
        getAIAnalysisRuns(caseId, { page: 1, page_size: RUNS_PAGE_SIZE }),
      ]);
      setAnalysisHistory(analysisRes.items);
      // Backend orders by created_at DESC, so the first item is the latest.
      setCurrentAnalysis(analysisRes.items[0] ?? null);
      setRunHistory(runsRes.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setAiError(err.message);
      } else {
        setAiError('Failed to load AI analysis.');
      }
    } finally {
      setLoadingAnalysis(false);
      setLoadingHistory(false);
      setLoadingRuns(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
    void loadConversations();
    void loadAI();
  }, [loadCase, loadConversations, loadAI]);

  const handleGenerateSummary = async () => {
    if (generating) return;
    setGenerating(true);
    setAiError(null);
    setAiSuccess(false);
    try {
      const analysis = await generateCaseSummary(caseId);
      setCurrentAnalysis(analysis);
      setAiSuccess(true);
      // Refresh history + runs
      const [analysisRes, runsRes] = await Promise.all([
        getCaseAnalyses(caseId, { page: 1, page_size: ANALYSIS_PAGE_SIZE }),
        getAIAnalysisRuns(caseId, { page: 1, page_size: RUNS_PAGE_SIZE }),
      ]);
      setAnalysisHistory(analysisRes.items);
      setRunHistory(runsRes.items);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.message.includes('no conversations')) {
          setAiError('Add at least one conversation before generating an AI summary.');
        } else if (err.status === 502) {
          setAiError('AI summary generation failed. Please try again.');
        } else {
          setAiError(err.message);
        }
      } else {
        setAiError('AI summary generation failed. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !message.trim()) {
      setSubmitError('Sender name and message are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await createConversation(caseId, {
        sender_type: senderType,
        sender_name: senderName.trim(),
        message: message.trim(),
        channel,
        timestamp: timestamp || null,
      });
      setSubmitSuccess(true);
      setSenderName('');
      setMessage('');
      setTimestamp('');
      setSenderType(SenderType.CUSTOMER);
      setChannel(ConversationChannel.CHAT);
      await loadConversations();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to add conversation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  if (loadingCase && !caseData) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-10">
            <div className="mx-auto h-4 w-40 rounded bg-slate-200" />
            <div className="mx-auto mt-3 h-3 w-64 rounded bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  if (caseError && !caseData) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-700">{caseError}</p>
            <Link href="/cases" className="mt-4 inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← Back to Cases
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!caseData) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top navigation */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg
                className="h-5 w-5"
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
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Conversation Intelligence</p>
              <p className="text-xs text-slate-500">AI-powered customer service intelligence</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/cases"
              className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
            >
              Cases
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/cases" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                ← Back to Cases
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{caseData.subject}</h1>
              <p className="mt-1 font-mono text-sm font-medium text-blue-600">{caseData.case_number}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(caseData.status)}`}>
                {caseData.status}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${priorityBadgeClass(caseData.priority)}`}>
                {caseData.priority} priority
              </span>
            </div>
          </div>
        </header>

        {caseError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {caseError}
          </div>
        )}

        {/* Case Information + Customer Information */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Case Information</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Case Number</dt>
                <dd className="font-mono font-medium text-blue-600">{caseData.case_number}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Category</dt>
                <dd className="text-slate-900">{caseData.category}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDate(caseData.created_at)}</dd>
              </div>
              {caseData.resolved_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Resolved</dt>
                  <dd className="text-slate-900">{formatDate(caseData.resolved_at)}</dd>
                </div>
              )}
              {caseData.assigned_agent && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Assigned Agent</dt>
                  <dd className="text-slate-900">{caseData.assigned_agent}</dd>
                </div>
              )}
              {caseData.description && (
                <div className="border-t border-slate-100 pt-3">
                  <dt className="mb-1 text-slate-500">Description</dt>
                  <dd className="whitespace-pre-wrap leading-6 text-slate-700">{caseData.description}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Customer Information</h2>
            {loadingCustomer ? (
              <p className="text-sm text-slate-500">Loading customer...</p>
            ) : customer ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium text-slate-900">{customer.name}</dd>
                </div>
                {customer.email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-900">{customer.email}</dd>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-900">{customer.phone}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Account</dt>
                  <dd className="font-mono text-xs text-slate-900">{customer.account_number}</dd>
                </div>
                {customer.address && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Address</dt>
                    <dd className="text-slate-900">{customer.address}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Customer information unavailable.</p>
            )}
          </section>
        </div>

        {/* ─── AI Analysis ───────────────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-blue-600"
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
              <h2 className="text-lg font-semibold text-slate-900">AI Analysis</h2>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={generating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generating AI summary...' : 'Generate Summary'}
            </button>
          </div>

          {aiSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              AI summary generated successfully.
            </div>
          )}
          {aiError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {aiError}
            </div>
          )}

          {/* Current analysis */}
          {generating ? (
            <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
              Generating AI summary... This may take a moment.
            </div>
          ) : loadingAnalysis ? (
            <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading AI analysis...
            </div>
          ) : currentAnalysis ? (
            <AnalysisDisplay
              analysis={currentAnalysis}
              analysisHistory={analysisHistory}
              runHistory={runHistory}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {`No AI analysis has been generated for this case yet. Click "Generate Summary" to create one.`}
            </div>
          )}
        </section>

        {/* ─── Conversation History ─────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Conversation History</h2>

          {conversationError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {conversationError}
            </div>
          )}

          {loadingConversations ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No conversations yet.</p>
          ) : (
            <div className="space-y-4">
              {conversations.map((conv) => {
                const isCustomer = conv.sender_type === SenderType.CUSTOMER;
                return (
                  <div key={conv.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl border p-4 ${
                        isCustomer ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50'
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-medium ${isCustomer ? 'text-slate-900' : 'text-blue-700'}`}>
                          {conv.sender_name}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${isCustomer ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                          {conv.sender_type}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          {conv.channel}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{conv.message}</p>
                      <p className="mt-2 text-[11px] text-slate-400">{formatDateTime(conv.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Add Conversation */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Conversation</h2>

          {submitSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Conversation added successfully.
            </div>
          )}
          {submitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Sender Type</label>
              <select
                value={senderType}
                onChange={(e) => setSenderType(e.target.value as SenderType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SENDER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Sender Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="John"
                maxLength={255}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ConversationChannel)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Timestamp (optional)</label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message content..."
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Conversation'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

// ─── AI Analysis Display ────────────────────────────────────────────────────

function AnalysisDisplay({
  analysis,
  analysisHistory,
  runHistory,
}: {
  analysis: AIAnalysis;
  analysisHistory: AIAnalysis[];
  runHistory: AIAnalysisRun[];
}) {
  return (
    <div className="space-y-6">
      {/* Classification badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${aiPriorityBadgeClass(analysis.ai_priority)}`}>
          {analysis.ai_priority} priority
        </span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${sentimentBadgeClass(analysis.sentiment)}`}>
          {analysis.sentiment}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {analysis.category}
        </span>
        {analysis.sentiment_score !== null && analysis.sentiment_score !== undefined && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Score: {analysis.sentiment_score.toFixed(2)}
          </span>
        )}
        <span className="text-xs text-slate-400">
          {new Date(analysis.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Summary</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{analysis.summary}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Issue</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{analysis.issue}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListBlock title="Key Details" items={analysis.key_details} emptyText="No key details identified." />
        <ListBlock title="Actions Taken" items={analysis.actions_taken} emptyText="No actions recorded." />
      </div>

      <ListBlock title="Pending Actions" items={analysis.pending_actions} emptyText="No pending actions identified." />

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Recommended Action</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          {analysis.recommended_action ?? 'No recommendation available.'}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        {analysis.model_name && <span>Model: {analysis.model_name}</span>}
        {analysis.model_name && analysis.prompt_version && <span> · </span>}
        {analysis.prompt_version && <span>Prompt: {analysis.prompt_version}</span>}
      </div>

      {/* Analysis History */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">Analysis History</h3>
        <div className="space-y-2">
          {analysisHistory.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <div className="flex flex-wrap gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${aiPriorityBadgeClass(a.ai_priority)}`}>{a.ai_priority}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${sentimentBadgeClass(a.sentiment)}`}>{a.sentiment}</span>
                </div>
              </div>
              <p className="mt-1 text-slate-700">{a.summary}</p>
              {a.model_name && <p className="mt-1 text-slate-400">Model: {a.model_name}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* AI Run History */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">AI Processing History</h3>
        <div className="space-y-2">
          {runHistory.length === 0 ? (
            <p className="text-xs text-slate-400">No AI processing history.</p>
          ) : (
            runHistory.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-600">{new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${runStatusBadgeClass(r.status)}`}>{r.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
                  {r.model_name && <span>Model: {r.model_name}</span>}
                  <span>Messages: {r.input_message_count}</span>
                  {r.processing_time_ms !== null && r.processing_time_ms !== undefined && (
                    <span>Time: {r.processing_time_ms}ms</span>
                  )}
                </div>
                {r.status === AIAnalysisRunStatus.FAILED && (
                  <p className="mt-1 text-red-600">AI processing failed for this run.</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ListBlock({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Badge helpers ──────────────────────────────────────────────────────────

function statusBadgeClass(status: string) {
  switch (status) {
    case CaseStatus.OPEN: return 'bg-emerald-50 text-emerald-700';
    case CaseStatus.IN_PROGRESS: return 'bg-amber-50 text-amber-700';
    case CaseStatus.RESOLVED: return 'bg-blue-50 text-blue-700';
    case CaseStatus.CLOSED: return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case CasePriority.LOW: return 'bg-emerald-50 text-emerald-700';
    case CasePriority.MEDIUM: return 'bg-amber-50 text-amber-700';
    case CasePriority.HIGH: return 'bg-orange-50 text-orange-700';
    case CasePriority.CRITICAL: return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function aiPriorityBadgeClass(priority: string) {
  switch (priority) {
    case CasePriority.LOW: return 'bg-emerald-50 text-emerald-700';
    case CasePriority.MEDIUM: return 'bg-amber-50 text-amber-700';
    case CasePriority.HIGH: return 'bg-orange-50 text-orange-700';
    case CasePriority.CRITICAL: return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function sentimentBadgeClass(sentiment: string) {
  switch (sentiment) {
    case Sentiment.POSITIVE: return 'bg-emerald-50 text-emerald-700';
    case Sentiment.NEUTRAL: return 'bg-slate-100 text-slate-600';
    case Sentiment.CONCERNED: return 'bg-amber-50 text-amber-700';
    case Sentiment.FRUSTRATED: return 'bg-orange-50 text-orange-700';
    case Sentiment.ANGRY: return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function runStatusBadgeClass(status: string) {
  switch (status) {
    case AIAnalysisRunStatus.SUCCESS: return 'bg-emerald-50 text-emerald-700';
    case AIAnalysisRunStatus.FAILED: return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}