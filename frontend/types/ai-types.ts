import type {
  AIAnalysisRunStatus,
  CaseCategory,
  CasePriority,
  Sentiment,
} from './enums';

export interface AIAnalysis {
  id: string;
  case_id: string;
  summary: string;
  issue: string;
  category: CaseCategory;
  sentiment: Sentiment;
  sentiment_score: number | null;
  ai_priority: CasePriority;
  key_details: string[];
  actions_taken: string[];
  pending_actions: string[];
  recommended_action: string | null;
  model_name: string | null;
  prompt_version: string | null;
  created_at: string;
}

export interface AIAnalysisRun {
  id: string;
  case_id: string;
  model_name: string | null;
  prompt_version: string | null;
  input_message_count: number;
  processing_time_ms: number | null;
  status: AIAnalysisRunStatus;
  error_message: string | null;
  created_at: string;
}

export interface AIAnalysisListResponse {
  items: AIAnalysis[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AIRunListResponse {
  items: AIAnalysisRun[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}