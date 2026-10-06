export enum EmailStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface EmailNotification {
  id: string;
  case_id: string;
  ai_analysis_id: string;
  to_email: string;
  cc_emails: string[];
  subject: string;
  status: EmailStatus;
  sent_at: string | null;
  sent_by: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface EmailHistoryResponse {
  items: EmailNotification[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface SendEmailSummaryRequest {
  to_email: string;
  cc_emails?: string[];
  subject: string;
}

export interface SendEmailSummaryResponse {
  status: 'sent';
  message: string;
  email_id: string;
  provider_message_id: string | null;
}
