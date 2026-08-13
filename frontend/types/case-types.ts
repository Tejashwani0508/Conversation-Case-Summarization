import type { Customer } from './customer-types';
import type { CaseCategory, CasePriority, CaseStatus } from './enums';

export interface Case {
  id: string;
  case_number: string;
  customer_id: string;
  subject: string;
  description: string | null;
  category: CaseCategory;
  status: CaseStatus;
  priority: CasePriority;
  assigned_agent: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseWithCustomer extends Case {
  customer?: Customer | null;
}

export interface CaseCreate {
  customer_id: string;
  subject: string;
  description?: string | null;
  category: CaseCategory;
  priority?: CasePriority | null;
  assigned_agent?: string | null;
}

export interface CaseUpdate {
  subject?: string;
  description?: string | null;
  category?: CaseCategory;
  priority?: CasePriority;
  status?: CaseStatus;
  assigned_agent?: string | null;
}

export interface CaseListResponse {
  items: Case[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}