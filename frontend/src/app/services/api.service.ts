import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Tag,
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

  // Tags
  getTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.apiUrl}/tags`);
  }

  getTag(id: number): Observable<Tag> {
    return this.http.get<Tag>(`${this.apiUrl}/tags/${id}`);
  }

  createTag(tag: Partial<Tag>): Observable<Tag> {
    return this.http.post<Tag>(`${this.apiUrl}/tags`, tag);
  }

  updateTag(id: number, tag: Partial<Tag>): Observable<Tag> {
    return this.http.put<Tag>(`${this.apiUrl}/tags/${id}`, tag);
  }

  deleteTag(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tags/${id}`);
  }

  // Transactions
  getTransactions(filters?: {
    start_date?: string;
    end_date?: string;
    type?: string;
    tag_id?: number;
    account_id?: number;
    account_type?: string;
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

  createTransaction(transaction: Partial<Transaction> & { tag_ids?: number[] }): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, transaction);
  }

  updateTransaction(id: number, transaction: Partial<Transaction> & { tag_ids?: number[] }): Observable<Transaction> {
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

  getTransactionTags(transactionId: number): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.apiUrl}/transactions/${transactionId}/tags`);
  }

  setTransactionTags(transactionId: number, tagIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/transactions/${transactionId}/tags`, {
      tag_ids: tagIds
    });
  }

  linkTransactions(transactionId1: number, transactionId2: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/transactions/link`, {
      transaction_id_1: transactionId1,
      transaction_id_2: transactionId2
    });
  }

  unlinkTransaction(transactionId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/transactions/${transactionId}/link`);
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
  getDashboard(startDate?: string, endDate?: string, accountType?: string, includeLinked?: boolean): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    if (accountType) params = params.set('account_type', accountType);
    if (includeLinked) params = params.set('include_linked', 'true');
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
