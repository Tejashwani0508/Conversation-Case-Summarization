export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_number: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  account_number: string;
  address?: string | null;
}

export interface CustomerUpdate {
  name?: string;
  email?: string | null;
  phone?: string | null;
  account_number?: string;
  address?: string | null;
}

export interface CustomerListResponse {
  items: Customer[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}