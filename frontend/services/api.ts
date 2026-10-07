import type { AIAnalysis, AIAnalysisListResponse, AIRunListResponse } from '../types/ai-types';
import type { Case, CaseCreate, CaseListResponse, CaseUpdate } from '../types/case-types';
import type { Customer, CustomerListResponse } from '../types/customer-types';
import type {
  Conversation,
  ConversationCreate,
  ConversationListResponse,
} from '../types/conversation-types';
import type {
  EmailHistoryResponse,
  SendEmailSummaryRequest,
  SendEmailSummaryResponse,
} from '../types/email-types';

// Environment-driven backend URL. Never store OpenAI credentials on the frontend.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.detail;
    } catch {
      // Not JSON
    }
    throw new ApiError(response.status, detail ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Cases ──────────────────────────────────────────────────────────────────

export interface CaseListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  priority?: string;
  customer_id?: string;
}

export async function createCase(payload: CaseCreate): Promise<Case> {
  return request<Case>('/api/cases', { method: 'POST', body: JSON.stringify(payload) });
}

export async function listCases(params: CaseListParams = {}): Promise<CaseListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.customer_id) query.set('customer_id', params.customer_id);
  const qs = query.toString();
  return request<CaseListResponse>(`/api/cases${qs ? `?${qs}` : ''}`);
}

export async function getCase(caseId: string): Promise<Case> {
  return request<Case>(`/api/cases/${caseId}`);
}

export async function getCaseByNumber(caseNumber: string): Promise<Case> {
  return request<Case>(`/api/cases/number/${encodeURIComponent(caseNumber)}`);
}

export async function updateCase(caseId: string, payload: CaseUpdate): Promise<Case> {
  return request<Case>(`/api/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteCase(caseId: string): Promise<void> {
  return request<void>(`/api/cases/${caseId}`, { method: 'DELETE' });
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function listCustomers(params: { page?: number; page_size?: number; search?: string } = {}): Promise<CustomerListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return request<CustomerListResponse>(`/api/customers${qs ? `?${qs}` : ''}`);
}

export async function getCustomer(customerId: string): Promise<Customer> {
  return request<Customer>(`/api/customers/${customerId}`);
}

// ─── Conversations ──────────────────────────────────────────────────────────

export interface ConversationListParams {
  page?: number;
  page_size?: number;
  sender_type?: string;
  channel?: string;
}

export async function createConversation(caseId: string, payload: ConversationCreate): Promise<Conversation> {
  return request<Conversation>(`/api/cases/${caseId}/conversations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listConversations(caseId: string, params: ConversationListParams = {}): Promise<ConversationListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  if (params.sender_type) query.set('sender_type', params.sender_type);
  if (params.channel) query.set('channel', params.channel);
  const qs = query.toString();
  return request<ConversationListResponse>(`/api/cases/${caseId}/conversations${qs ? `?${qs}` : ''}`);
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  return request<Conversation>(`/api/conversations/${conversationId}`);
}

export async function getConversationHistory(caseId: string): Promise<Conversation[]> {
  return request<Conversation[]>(`/api/cases/${caseId}/conversations/history`);
}

// ─── AI Analysis ────────────────────────────────────────────────────────────

export async function generateCaseSummary(caseId: string): Promise<AIAnalysis> {
  return request<AIAnalysis>(`/api/cases/${caseId}/summarize`, { method: 'POST' });
}

export async function getCaseAnalyses(caseId: string, params: { page?: number; page_size?: number } = {}): Promise<AIAnalysisListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return request<AIAnalysisListResponse>(`/api/cases/${caseId}/analysis${qs ? `?${qs}` : ''}`);
}

export async function getAIAnalysis(analysisId: string): Promise<AIAnalysis> {
  return request<AIAnalysis>(`/api/ai-analysis/${analysisId}`);
}

export async function listAIAnalyses(params: { page?: number; page_size?: number } = {}): Promise<AIAnalysisListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return request<AIAnalysisListResponse>(`/api/ai-analysis${qs ? `?${qs}` : ''}`);
}

export async function getAIAnalysisRuns(caseId: string, params: { page?: number; page_size?: number } = {}): Promise<AIRunListResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return request<AIRunListResponse>(`/api/cases/${caseId}/analysis/runs${qs ? `?${qs}` : ''}`);
}

export async function sendCaseSummaryEmail(
  caseId: string,
  payload: SendEmailSummaryRequest,
): Promise<SendEmailSummaryResponse> {
  return request<SendEmailSummaryResponse>(`/api/cases/${caseId}/ai-summary/email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCaseEmailHistory(caseId: string): Promise<EmailHistoryResponse> {
  return request<EmailHistoryResponse>(`/api/cases/${caseId}/email-history`);
}