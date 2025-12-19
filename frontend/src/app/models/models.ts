export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id?: number;
  description: string;
  detail?: string;
  amount: number;
  currency: string; // PEN, USD
  type: 'income' | 'expense';
  date: string;
  source: string;
  raw_text?: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  account?: Account;
}

export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  transaction_count: number;
  by_tag: TagSummary[];
  recent_transactions: Transaction[];
}

export interface TagSummary {
  tag_id: number;
  tag_name: string;
  color: string;
  total: number;
  total_pen: number;
  total_usd: number;
  count: number;
  type: string;
}

export interface ParsedTransaction {
  description: string;
  detail?: string;
  amount: number;
  currency: string; // PEN, USD
  type: 'income' | 'expense';
  date: string;
  raw_text: string;
  tag_ids?: number[];
  suggested_tag_ids?: number[];
  is_duplicate?: boolean;
  existing_tag_ids?: number[];
}

export interface ImportResponse {
  import_id: number;
  transactions: ParsedTransaction[];
  count: number;
  message: string;
}

export interface Import {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  total_transactions: number;
  processed_transactions: number;
  created_at: string;
}

export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank?: string;
  account_type: 'debit' | 'credit';
  currency: string;
  account_number?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  income: number;
  expense: number;
  balance: number;
}
