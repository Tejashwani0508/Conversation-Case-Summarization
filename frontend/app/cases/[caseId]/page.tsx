'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import {
  getCase,
  getCustomer,
  updateCase,
  getConversationHistory,
  createConversation,
  generateCaseSummary,
  getCaseAnalyses,
  getAIAnalysisRuns,
  getCaseEmailHistory,
  sendCaseSummaryEmail,
  ApiError,
} from '../../../services/api';
import type { Case } from '../../../types/case-types';
import type { Customer } from '../../../types/customer-types';
import type { Conversation } from '../../../types/conversation-types';
import type { AIAnalysis, AIAnalysisRun } from '../../../types/ai-types';
import type { EmailNotification } from '../../../types/email-types';
import { EmailStatus } from '../../../types/email-types';
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
  const [editingCaseField, setEditingCaseField] = useState<'status' | 'priority' | null>(null);
  const [statusDraft, setStatusDraft] = useState<CaseStatus>(CaseStatus.OPEN);
  const [priorityDraft, setPriorityDraft] = useState<CasePriority>(CasePriority.MEDIUM);
  const [savingCaseField, setSavingCaseField] = useState(false);
  const [caseUpdateError, setCaseUpdateError] = useState<string | null>(null);
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

  // Email summary state
  const [emailHistory, setEmailHistory] = useState<EmailNotification[]>([]);
  const [loadingEmailHistory, setLoadingEmailHistory] = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: '',
    cc_emails: '',
    subject: '',
  });
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitMessage, setEmailSubmitMessage] = useState<string | null>(null);
  const [emailSubmitError, setEmailSubmitError] = useState<string | null>(null);

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

  const loadEmailHistory = useCallback(async () => {
    setLoadingEmailHistory(true);
    try {
      const data = await getCaseEmailHistory(caseId);
      setEmailHistory(data.items);
    } catch {
      setEmailHistory([]);
    } finally {
      setLoadingEmailHistory(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
    void loadConversations();
    void loadAI();
    void loadEmailHistory();
  }, [loadCase, loadConversations, loadAI, loadEmailHistory]);

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

  const handleOpenEmailModal = () => {
    if (!currentAnalysis || !caseData) return;
    setEmailSubmitMessage(null);
    setEmailSubmitError(null);
    setEmailForm({
      to_email: customer?.email ?? '',
      cc_emails: '',
      subject: `AI Case Summary — ${caseData.case_number}`,
    });
    setEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!currentAnalysis || !caseData) return;
    const toEmail = emailForm.to_email.trim();
    const ccEmails = emailForm.cc_emails
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!toEmail || !isValidEmail(toEmail)) {
      setEmailSubmitError('Please enter a valid recipient email address.');
      return;
    }

    const invalidCC = ccEmails.find((value) => !isValidEmail(value));
    if (invalidCC) {
      setEmailSubmitError(`Invalid CC email: ${invalidCC}`);
      return;
    }

    setEmailSubmitting(true);
    setEmailSubmitError(null);
    setEmailSubmitMessage(null);

    try {
      await sendCaseSummaryEmail(caseId, {
        to_email: toEmail,
        cc_emails: ccEmails,
        subject: emailForm.subject.trim() || `AI Case Summary — ${caseData.case_number}`,
      });
      setEmailSubmitMessage('Email sent successfully.');
      await loadEmailHistory();
      setTimeout(() => {
        setEmailModalOpen(false);
        setEmailSubmitMessage(null);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError) {
        setEmailSubmitError(err.message || 'Unable to send the email. Please try again.');
      } else {
        setEmailSubmitError('Unable to send the email. Please try again.');
      }
    } finally {
      setEmailSubmitting(false);
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

  const startCaseFieldEdit = (field: 'status' | 'priority') => {
    if (!caseData) return;
    setCaseUpdateError(null);
    setEditingCaseField(field);
    if (field === 'status') setStatusDraft(caseData.status);
    else setPriorityDraft(caseData.priority);
  };

  const cancelCaseFieldEdit = () => {
    if (savingCaseField) return;
    setEditingCaseField(null);
    setCaseUpdateError(null);
  };

  const saveCaseField = async () => {
    if (!caseData || !editingCaseField || savingCaseField) return;
    setSavingCaseField(true);
    setCaseUpdateError(null);
    try {
      const updatedCase = editingCaseField === 'status'
        ? await updateCase(caseId, { status: statusDraft })
        : await updateCase(caseId, { priority: priorityDraft });
      setCaseData(updatedCase);
      setEditingCaseField(null);
    } catch (err) {
      setCaseUpdateError(err instanceof ApiError ? err.message : 'Unable to update the case. Please try again.');
    } finally {
      setSavingCaseField(false);
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                {editingCaseField === 'status' ? (
                  <>
                    <select
                      aria-label="Case status"
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as CaseStatus)}
                      disabled={savingCaseField}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {Object.values(CaseStatus).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button onClick={() => void saveCaseField()} disabled={savingCaseField} className="text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50">
                      {savingCaseField ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelCaseFieldEdit} disabled={savingCaseField} className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(caseData.status)}`}>
                      {caseData.status}
                    </span>
                    <button onClick={() => startCaseFieldEdit('status')} className="text-xs font-medium text-blue-700 hover:text-blue-800">Edit status</button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingCaseField === 'priority' ? (
                  <>
                    <select
                      aria-label="Case priority"
                      value={priorityDraft}
                      onChange={(event) => setPriorityDraft(event.target.value as CasePriority)}
                      disabled={savingCaseField}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {Object.values(CasePriority).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button onClick={() => void saveCaseField()} disabled={savingCaseField} className="text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50">
                      {savingCaseField ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelCaseFieldEdit} disabled={savingCaseField} className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${priorityBadgeClass(caseData.priority)}`}>
                      {caseData.priority} priority
                    </span>
                    <button onClick={() => startCaseFieldEdit('priority')} className="text-xs font-medium text-blue-700 hover:text-blue-800">Edit priority</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {caseUpdateError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {caseUpdateError}
          </div>
        )}

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

        {/* ─── AI Case Analysis ─────────────────────────────────────────── */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          {/* AI Analysis header */}
          <div className="border-b border-blue-100 bg-blue-50/40 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <SparklesIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">AI Case Analysis</h2>
                  <p className="text-sm text-slate-500">
                    AI-powered insights generated from the customer conversation
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentAnalysis && (
                  <button
                    onClick={handleOpenEmailModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25A2.25 2.25 0 0 1 5.25 6h13.5A2.25 2.25 0 0 1 21 8.25v7.5A2.25 2.25 0 0 1 18.75 18H5.25A2.25 2.25 0 0 1 3 15.75v-7.5Zm0 0 9 6 9-6" />
                    </svg>
                    Send AI Summary
                  </button>
                )}
                <button
                  onClick={handleGenerateSummary}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  {generating ? 'Generating Analysis...' : 'Generate Summary'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {aiSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                AI analysis generated successfully.
              </div>
            )}

            {generating ? (
              <AIGeneratingSkeleton />
            ) : loadingAnalysis ? (
              <AIGeneratingSkeleton />
            ) : aiError ? (
              <AIErrorState onRetry={handleGenerateSummary} retrying={generating} />
            ) : currentAnalysis ? (
              <AnalysisDisplay
                analysis={currentAnalysis}
                analysisHistory={analysisHistory}
                runHistory={runHistory}
              />
            ) : (
              <AIEmptyState onGenerate={handleGenerateSummary} generating={generating} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Email Activity</h2>
          {loadingEmailHistory ? (
            <p className="text-sm text-slate-500">Loading email activity...</p>
          ) : emailHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No email activity recorded for this case.</p>
          ) : (
            <div className="space-y-3">
              {emailHistory.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{entry.status === EmailStatus.FAILED ? 'AI Summary email failed' : 'AI Summary sent'}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${emailStatusBadgeClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">To: {entry.to_email}</p>
                  {entry.sent_at && (
                    <p className="mt-1 text-xs text-slate-500">Sent: {new Date(entry.sent_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  )}
                  {entry.error_message && (
                    <p className="mt-1 text-xs text-red-600">{entry.error_message}</p>
                  )}
                </div>
              ))}
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

      {emailModalOpen && currentAnalysis && caseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Send AI Summary</h3>
                  <p className="text-sm text-slate-500">Review and send the latest AI summary by email.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close email dialog"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.05fr_1.35fr]">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
                    <input
                      type="email"
                      value={emailForm.to_email}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, to_email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="recipient@example.com"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">CC</label>
                    <input
                      type="text"
                      value={emailForm.cc_emails}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, cc_emails: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="optional@example.com, team@example.com"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                    <input
                      type="text"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {emailSubmitError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {emailSubmitError}
                    </div>
                  )}

                  {emailSubmitMessage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {emailSubmitMessage}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="mb-4 border-b border-slate-200 pb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Email Preview</p>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="border-b border-slate-100 pb-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Conversation Intelligence</p>
                        <h4 className="mt-2 text-xl font-semibold text-slate-900">AI Case Summary</h4>
                      </div>

                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Case</span>
                          <span className="font-medium text-slate-900">{caseData.case_number}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Customer</span>
                          <span className="font-medium text-slate-900">{customer?.name ?? 'Customer'}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Category</span>
                          <span>{caseData.category}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Priority</span>
                          <span>{caseData.priority}</span>
                        </div>
                        <div className="flex justify-between gap-3 pb-2">
                          <span className="text-slate-500">Status</span>
                          <span>{caseData.status}</span>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Summary</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{currentAnalysis.summary}</p>
                      </div>

                      {currentAnalysis.recommended_action && (
                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Action</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{currentAnalysis.recommended_action}</p>
                        </div>
                      )}

                      <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center">
                        <a href={`/cases/${caseData.id}`} className="text-sm font-medium text-blue-700">View Case</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={emailSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailSubmitting ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── AI Empty State ─────────────────────────────────────────────────────────

function AIEmptyState({
  onGenerate,
  generating,
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
        <SparklesIcon className="h-8 w-8" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Generate an AI-powered case summary</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {`Analyze the conversation to identify the customer's issue, sentiment, priority, key details, and recommended next actions.`}
      </p>
      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          {generating ? 'Generating Analysis...' : 'Generate AI Summary'}
        </button>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Powered by conversation intelligence
        </p>
      </div>
    </div>
  );
}

// ─── AI Error State ─────────────────────────────────────────────────────────

function AIErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50/50 px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg
          className="h-6 w-6"
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
      </div>
      <h3 className="text-base font-semibold text-slate-900">AI analysis could not be generated</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
        Something went wrong while generating the AI analysis. Please try again.
      </p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        {retrying ? 'Retrying...' : 'Try Again'}
      </button>
    </div>
  );
}

// ─── AI Generating Skeleton ─────────────────────────────────────────────────

function AIGeneratingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
        <svg
          className="h-4 w-4 animate-spin text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-sm font-medium text-blue-700">Generating insights from conversation...</p>
      </div>

      <div className="animate-pulse space-y-4">
        {/* Summary skeleton */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 h-3 w-32 rounded bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200" />
            <div className="h-3 w-11/12 rounded bg-slate-200" />
            <div className="h-3 w-4/5 rounded bg-slate-200" />
          </div>
        </div>

        {/* Classification skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 h-3 w-28 rounded bg-slate-200" />
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-20 rounded-full bg-slate-200" />
              <div className="h-6 w-24 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 h-3 w-28 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-200" />
          </div>
        </div>

        {/* Key Details skeleton */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 h-3 w-24 rounded bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-10/12 rounded bg-slate-100" />
            <div className="h-3 w-8/12 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
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
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <div className="space-y-6">
      {/* A. Executive Summary */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Executive Summary
          </h3>
        </div>
        <p className="text-sm leading-6 text-slate-700">{analysis.summary}</p>
      </div>

      {/* B. Case Classification + C. Sentiment & Confidence */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Case Classification
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-400">Issue</p>
              <p className="mt-0.5 text-sm text-slate-700">{analysis.issue}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Category</p>
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {analysis.category}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-slate-400">Priority</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${aiPriorityBadgeClass(analysis.ai_priority)}`}>
                    {analysis.ai_priority}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Sentiment</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBadgeClass(analysis.sentiment)}`}>
                    {analysis.sentiment}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sentiment & Confidence
          </h3>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${sentimentBadgeClass(analysis.sentiment)}`}>
              {analysis.sentiment}
            </span>
            {analysis.sentiment_score !== null && analysis.sentiment_score !== undefined && (
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-400">AI confidence</span>
                  <span className="text-xs font-medium text-slate-600">
                    {(analysis.sentiment_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, analysis.sentiment_score * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {analysis.sentiment_score === null || analysis.sentiment_score === undefined ? (
            <p className="mt-2 text-xs text-slate-400">No confidence score available for this analysis.</p>
          ) : null}
        </div>
      </div>

      {/* D. Key Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Key Details
        </h3>
        {analysis.key_details.length === 0 ? (
          <p className="text-sm text-slate-400">No key details identified.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.key_details.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* E. Recommended Action + F. Pending Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Recommended Action
          </h3>
          <p className="text-sm leading-6 text-slate-700">
            {analysis.recommended_action ?? 'No recommendation available.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending Actions
          </h3>
          {analysis.pending_actions.length === 0 ? (
            <p className="text-sm text-slate-400">No pending actions identified.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.pending_actions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions Taken */}
      {analysis.actions_taken.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Actions Taken
          </h3>
          <ul className="space-y-2">
            {analysis.actions_taken.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                <CheckCircleIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* G. AI Metadata */}
      {(analysis.model_name || analysis.prompt_version) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-400">
          {analysis.model_name && <span>Model: {analysis.model_name}</span>}
          {analysis.model_name && analysis.prompt_version && <span>·</span>}
          {analysis.prompt_version && <span>Prompt: {analysis.prompt_version}</span>}
          <span className="text-slate-300">·</span>
          <span>Analyzed: {formatDateTime(analysis.created_at)}</span>
        </div>
      )}

      {/* Analysis History */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Analysis History
        </h3>
        <div className="space-y-2">
          {analysisHistory.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600">{formatDateTime(a.created_at)}</span>
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
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          AI Processing History
        </h3>
        <div className="space-y-2">
          {runHistory.length === 0 ? (
            <p className="text-xs text-slate-400">No AI processing history.</p>
          ) : (
            runHistory.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-600">{formatDateTime(r.created_at)}</span>
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

// ─── Icons ──────────────────────────────────────────────────────────────────

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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function emailStatusBadgeClass(status: string) {
  switch (status) {
    case EmailStatus.SENT: return 'bg-emerald-50 text-emerald-700';
    case EmailStatus.FAILED: return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
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