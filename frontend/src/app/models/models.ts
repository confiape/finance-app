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

export interface Category {
  id: number;
  user_id?: number;
  parent_id?: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
  subcategories?: Category[];
  parent?: Category;
}

export interface Transaction {
  id: number;
  user_id: number;
  category_id?: number;
  description: string;
  detail?: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  source: string;
  raw_text?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  transaction_count: number;
  by_category: CategorySummary[];
  recent_transactions: Transaction[];
}

export interface CategorySummary {
  category_id: number;
  category_name: string;
  color: string;
  total: number;
  count: number;
  type: string;
}

export interface ParsedTransaction {
  description: string;
  detail?: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  raw_text: string;
  category_id?: number;
  suggested_category_id?: number;
  is_duplicate?: boolean;
  existing_category_id?: number;
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
