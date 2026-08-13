import type { ConversationChannel, SenderType } from './enums';

export interface Conversation {
  id: string;
  case_id: string;
  sender_type: SenderType;
  sender_name: string;
  message: string;
  timestamp: string;
  channel: ConversationChannel;
  created_at: string;
}

export interface ConversationCreate {
  sender_type: SenderType;
  sender_name: string;
  message: string;
  timestamp?: string | null;
  channel: ConversationChannel;
}

export interface ConversationListResponse {
  items: Conversation[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}