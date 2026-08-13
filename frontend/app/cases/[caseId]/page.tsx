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
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
            Loading case...
          </div>
        </div>
      </main>
    );
  }

  if (caseError && !caseData) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <div className="rounded-2xl border border-red-800 bg-red-950/60 p-6">
            <p className="text-red-300">{caseError}</p>
            <Link href="/cases" className="mt-4 inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900">
              ← Back to Cases
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!caseData) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/cases" className="text-sm text-blue-400 hover:text-blue-300">
                ← Back to Cases
              </Link>
              <h1 className="mt-2 text-3xl font-semibold">{caseData.subject}</h1>
              <p className="mt-1 font-mono text-sm text-blue-400">{caseData.case_number}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(caseData.status)}`}>
                {caseData.status}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${priorityBadgeClass(caseData.priority)}`}>
                {caseData.priority} priority
              </span>
            </div>
          </div>
        </header>

        {caseError && (
          <div className="mb-6 rounded-lg border border-amber-800 bg-amber-950/60 p-4 text-sm text-amber-300">
            {caseError}
          </div>
        )}

        {/* Case Information + Customer Information */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold">Case Information</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Case Number</dt>
                <dd className="font-mono text-blue-400">{caseData.case_number}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Category</dt>
                <dd>{caseData.category}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Created</dt>
                <dd>{formatDate(caseData.created_at)}</dd>
              </div>
              {caseData.resolved_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Resolved</dt>
                  <dd>{formatDate(caseData.resolved_at)}</dd>
                </div>
              )}
              {caseData.assigned_agent && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Assigned Agent</dt>
                  <dd>{caseData.assigned_agent}</dd>
                </div>
              )}
              {caseData.description && (
                <div className="border-t border-slate-800 pt-3">
                  <dt className="mb-1 text-slate-400">Description</dt>
                  <dd className="whitespace-pre-wrap leading-6 text-slate-300">{caseData.description}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold">Customer Information</h2>
            {loadingCustomer ? (
              <p className="text-sm text-slate-400">Loading customer...</p>
            ) : customer ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Name</dt>
                  <dd className="font-medium">{customer.name}</dd>
                </div>
                {customer.email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Email</dt>
                    <dd>{customer.email}</dd>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Phone</dt>
                    <dd>{customer.phone}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Account</dt>
                  <dd className="font-mono text-xs">{customer.account_number}</dd>
                </div>
                {customer.address && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Address</dt>
                    <dd>{customer.address}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Customer information unavailable.</p>
            )}
          </section>
        </div>

        {/* ─── AI Analysis ───────────────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-blue-900/40 bg-blue-950/20 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">AI Analysis</h2>
            <button
              onClick={handleGenerateSummary}
              disabled={generating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generating AI summary...' : 'Generate Summary'}
            </button>
          </div>

          {aiSuccess && (
            <div className="mb-4 rounded-lg border border-green-800 bg-green-950/60 p-4 text-sm text-green-300">
              AI summary generated successfully.
            </div>
          )}
          {aiError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
              {aiError}
            </div>
          )}

          {/* Current analysis */}
          {generating ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
              Generating AI summary... This may take a moment.
            </div>
          ) : loadingAnalysis ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
              Loading AI analysis...
            </div>
          ) : currentAnalysis ? (
            <AnalysisDisplay
              analysis={currentAnalysis}
              analysisHistory={analysisHistory}
              runHistory={runHistory}
            />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
              {`No AI analysis has been generated for this case yet. Click "Generate Summary" to create one.`}
            </div>
          )}
        </section>

        {/* ─── Conversation History ─────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Conversation History</h2>

          {conversationError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
              {conversationError}
            </div>
          )}

          {loadingConversations ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No conversations yet.</p>
          ) : (
            <div className="space-y-4">
              {conversations.map((conv) => {
                const isCustomer = conv.sender_type === SenderType.CUSTOMER;
                return (
                  <div key={conv.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl border p-4 ${
                        isCustomer ? 'border-slate-700 bg-slate-800/80' : 'border-blue-800/60 bg-blue-900/30'
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-medium ${isCustomer ? 'text-slate-200' : 'text-blue-300'}`}>
                          {conv.sender_name}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${isCustomer ? 'bg-slate-700 text-slate-300' : 'bg-blue-800/70 text-blue-200'}`}>
                          {conv.sender_type}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {conv.channel}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{conv.message}</p>
                      <p className="mt-2 text-[11px] text-slate-500">{formatDateTime(conv.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Add Conversation */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Add Conversation</h2>

          {submitSuccess && (
            <div className="mb-4 rounded-lg border border-green-800 bg-green-950/60 p-4 text-sm text-green-300">
              Conversation added successfully.
            </div>
          )}
          {submitError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Sender Type</label>
              <select
                value={senderType}
                onChange={(e) => setSenderType(e.target.value as SenderType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                {SENDER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Sender Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="John"
                maxLength={255}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ConversationChannel)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Timestamp (optional)</label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message content..."
                rows={4}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${aiPriorityBadgeClass(analysis.ai_priority)}`}>
          {analysis.ai_priority} priority
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${sentimentBadgeClass(analysis.sentiment)}`}>
          {analysis.sentiment}
        </span>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
          {analysis.category}
        </span>
        {analysis.sentiment_score !== null && analysis.sentiment_score !== undefined && (
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
            Score: {analysis.sentiment_score.toFixed(2)}
          </span>
        )}
        <span className="text-xs text-slate-500">
          {new Date(analysis.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-400">Summary</h3>
        <p className="mt-1 text-sm leading-6 text-slate-200">{analysis.summary}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-400">Issue</h3>
        <p className="mt-1 text-sm leading-6 text-slate-200">{analysis.issue}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListBlock title="Key Details" items={analysis.key_details} emptyText="No key details identified." />
        <ListBlock title="Actions Taken" items={analysis.actions_taken} emptyText="No actions recorded." />
      </div>

      <ListBlock title="Pending Actions" items={analysis.pending_actions} emptyText="No pending actions identified." />

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-400">Recommended Action</h3>
        <p className="mt-1 text-sm leading-6 text-slate-200">
          {analysis.recommended_action ?? 'No recommendation available.'}
        </p>
      </div>

      <div className="border-t border-slate-800 pt-3 text-xs text-slate-500">
        {analysis.model_name && <span>Model: {analysis.model_name}</span>}
        {analysis.model_name && analysis.prompt_version && <span> · </span>}
        {analysis.prompt_version && <span>Prompt: {analysis.prompt_version}</span>}
      </div>

      {/* Analysis History */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-400">Analysis History</h3>
        <div className="space-y-2">
          {analysisHistory.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-300">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <div className="flex flex-wrap gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${aiPriorityBadgeClass(a.ai_priority)}`}>{a.ai_priority}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${sentimentBadgeClass(a.sentiment)}`}>{a.sentiment}</span>
                </div>
              </div>
              <p className="mt-1 text-slate-300">{a.summary}</p>
              {a.model_name && <p className="mt-1 text-slate-500">Model: {a.model_name}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* AI Run History */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-400">AI Processing History</h3>
        <div className="space-y-2">
          {runHistory.length === 0 ? (
            <p className="text-xs text-slate-500">No AI processing history.</p>
          ) : (
            runHistory.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-300">{new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${runStatusBadgeClass(r.status)}`}>{r.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
                  {r.model_name && <span>Model: {r.model_name}</span>}
                  <span>Messages: {r.input_message_count}</span>
                  {r.processing_time_ms !== null && r.processing_time_ms !== undefined && (
                    <span>Time: {r.processing_time_ms}ms</span>
                  )}
                </div>
                {r.status === AIAnalysisRunStatus.FAILED && (
                  <p className="mt-1 text-red-400">AI processing failed for this run.</p>
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
      <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-400">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-slate-200">
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
    case CaseStatus.OPEN: return 'bg-green-900/60 text-green-300';
    case CaseStatus.IN_PROGRESS: return 'bg-amber-900/60 text-amber-300';
    case CaseStatus.RESOLVED: return 'bg-emerald-900/60 text-emerald-300';
    case CaseStatus.CLOSED: return 'bg-slate-800 text-slate-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case CasePriority.LOW: return 'bg-slate-800 text-slate-300';
    case CasePriority.MEDIUM: return 'bg-blue-900/60 text-blue-300';
    case CasePriority.HIGH: return 'bg-amber-900/60 text-amber-300';
    case CasePriority.CRITICAL: return 'bg-red-900/60 text-red-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function aiPriorityBadgeClass(priority: string) {
  switch (priority) {
    case CasePriority.LOW: return 'bg-slate-800 text-slate-300';
    case CasePriority.MEDIUM: return 'bg-blue-900/60 text-blue-300';
    case CasePriority.HIGH: return 'bg-amber-900/60 text-amber-300';
    case CasePriority.CRITICAL: return 'bg-red-900/60 text-red-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function sentimentBadgeClass(sentiment: string) {
  switch (sentiment) {
    case Sentiment.POSITIVE: return 'bg-green-900/60 text-green-300';
    case Sentiment.NEUTRAL: return 'bg-slate-800 text-slate-300';
    case Sentiment.CONCERNED: return 'bg-amber-900/60 text-amber-300';
    case Sentiment.FRUSTRATED: return 'bg-orange-900/60 text-orange-300';
    case Sentiment.ANGRY: return 'bg-red-900/60 text-red-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function runStatusBadgeClass(status: string) {
  switch (status) {
    case AIAnalysisRunStatus.SUCCESS: return 'bg-green-900/60 text-green-300';
    case AIAnalysisRunStatus.FAILED: return 'bg-red-900/60 text-red-300';
    default: return 'bg-slate-800 text-slate-300';
  }
}