import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Category,
  Transaction,
  DashboardSummary,
  ImportResponse,
  Import,
  Account,
  AccountBalance
} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Categories
  getCategories(type?: 'income' | 'expense'): Observable<Category[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<Category[]>(`${this.apiUrl}/categories`, { params });
  }

  getCategoriesFlat(type?: 'income' | 'expense'): Observable<Category[]> {
    let params = new HttpParams().set('flat', 'true');
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<Category[]>(`${this.apiUrl}/categories`, { params });
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, category);
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, category);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`);
  }

  // Transactions
  getTransactions(filters?: {
    start_date?: string;
    end_date?: string;
    type?: string;
    category_id?: number;
  }): Observable<Transaction[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions`, { params });
  }

  createTransaction(transaction: Partial<Transaction>): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, transaction);
  }

  updateTransaction(id: number, transaction: Partial<Transaction>): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/transactions/${id}`, transaction);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/transactions/${id}`);
  }

  deleteTransactionsBatch(ids: number[]): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.apiUrl}/transactions`, {
      body: { ids }
    });
  }

  updateTransactionCategory(id: number, categoryId: number): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.apiUrl}/transactions/${id}/category`, {
      category_id: categoryId
    });
  }

  // Accounts
  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/accounts`);
  }

  getAccount(id: number): Observable<Account> {
    return this.http.get<Account>(`${this.apiUrl}/accounts/${id}`);
  }

  createAccount(account: Partial<Account>): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/accounts`, account);
  }

  updateAccount(id: number, account: Partial<Account>): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/accounts/${id}`, account);
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/accounts/${id}`);
  }

  getAccountBalance(id: number): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.apiUrl}/accounts/${id}/balance`);
  }

  // Dashboard
  getDashboard(startDate?: string, endDate?: string): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard`, { params });
  }

  // Banks
  getBanks(): Observable<{ id: string; name: string }[]> {
    return this.http.get<{ id: string; name: string }[]>(`${this.apiUrl}/banks`);
  }

  // Import
  uploadFile(file: File, bankId: string, accountId: number): Observable<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank', bankId);
    formData.append('account_id', accountId.toString());
    return this.http.post<ImportResponse>(`${this.apiUrl}/import/upload`, formData);
  }

  confirmImport(importId: number, accountId: number, transactions: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/import/confirm`, {
      import_id: importId,
      account_id: accountId,
      transactions
    });
  }

  getImports(): Observable<Import[]> {
    return this.http.get<Import[]>(`${this.apiUrl}/imports`);
  }
}
