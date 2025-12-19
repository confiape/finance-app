import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';
import { Transaction } from '../../models/models';

@Component({
  selector: 'app-link-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    DecimalPipe
  ],
  template: `
    <h2 mat-dialog-title>Vincular transacción</h2>
    <mat-dialog-content>
      <div class="source-transaction">
        <p class="label">Transacción a vincular:</p>
        <div class="transaction-preview" [class.expense]="data.type === 'expense'" [class.income]="data.type === 'income'">
          <div class="tx-icon" [style.background-color]="data.tags?.[0]?.color || '#64748b'">
            <mat-icon>{{ data.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
          </div>
          <div class="tx-info">
            <span class="tx-desc">{{ data.detail || data.description }}</span>
            <span class="tx-amount">
              {{ data.type === 'expense' ? '-' : '+' }}{{ data.currency === 'USD' ? 'US$ ' : 'S/ ' }}{{ data.amount | number:'1.2-2' }}
            </span>
          </div>
        </div>
      </div>

      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Buscar transacción</mat-label>
        <input matInput [(ngModel)]="searchQuery" (input)="filterTransactions()" placeholder="Buscar por descripción...">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else if (filteredTransactions().length === 0) {
        <div class="empty-state">
          <mat-icon>link_off</mat-icon>
          <p>No hay transacciones de {{ oppositeType }} disponibles para vincular</p>
        </div>
      } @else {
        <div class="transactions-list">
          <p class="list-label">Selecciona una transacción de {{ oppositeType }}:</p>
          @for (tx of filteredTransactions(); track tx.id) {
            <button
              class="transaction-option"
              [class.selected]="selectedId === tx.id"
              [class.expense]="tx.type === 'expense'"
              [class.income]="tx.type === 'income'"
              (click)="selectTransaction(tx)"
            >
              <div class="tx-icon" [style.background-color]="tx.tags?.[0]?.color || '#64748b'">
                <mat-icon>{{ tx.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
              </div>
              <div class="tx-info">
                <span class="tx-desc">{{ tx.detail || tx.description }}</span>
                <span class="tx-meta">{{ formatDate(tx.date) }}</span>
              </div>
              <span class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.currency === 'USD' ? 'US$ ' : 'S/ ' }}{{ tx.amount | number:'1.2-2' }}
              </span>
              @if (selectedId === tx.id) {
                <mat-icon class="check-icon">check_circle</mat-icon>
              }
            </button>
          }
        </div>
      }

      @if (selectedId && selectedTransaction) {
        <div class="net-amount-preview">
          <mat-icon>calculate</mat-icon>
          <div class="net-info">
            <span class="net-label">Monto neto después de vincular:</span>
            <span class="net-value" [class.positive]="netAmount >= 0" [class.negative]="netAmount < 0">
              S/ {{ netAmount | number:'1.2-2' }}
            </span>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button color="primary" [disabled]="!selectedId || saving()" (click)="link()">
        @if (saving()) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          Vincular
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 350px;
      max-height: 70vh;
    }

    .source-transaction {
      margin-bottom: 16px;

      .label {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 8px;
      }
    }

    .transaction-preview, .transaction-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 2px solid transparent;

      &.expense {
        border-left: 4px solid #ef4444;
      }

      &.income {
        border-left: 4px solid #22c55e;
      }
    }

    .transaction-option {
      width: 100%;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      text-align: left;

      &:hover {
        background: #f1f5f9;
      }

      &.selected {
        border-color: #6366f1;
        background: #eef2ff;
      }
    }

    .tx-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: white;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .tx-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .tx-desc {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tx-meta {
        font-size: 0.75rem;
        color: #64748b;
      }
    }

    .tx-amount {
      font-weight: 600;
      white-space: nowrap;

      &.income { color: #22c55e; }
      &.expense { color: #ef4444; }
    }

    .search-field {
      width: 100%;
      margin-bottom: 8px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
    }

    .list-label {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 8px;
    }

    .transactions-list {
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .check-icon {
      color: #6366f1;
    }

    .net-amount-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #fef3c7;
      border-radius: 8px;
      margin-top: 16px;

      mat-icon {
        color: #d97706;
      }

      .net-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .net-label {
        font-size: 0.85rem;
        color: #92400e;
      }

      .net-value {
        font-weight: 600;
        font-size: 1.1rem;

        &.positive { color: #22c55e; }
        &.negative { color: #ef4444; }
      }
    }

    mat-dialog-actions button mat-spinner {
      display: inline-block;
    }
  `]
})
export class LinkTransactionDialogComponent implements OnInit {
  private apiService = inject(ApiService);
  private dialogRef = inject(MatDialogRef<LinkTransactionDialogComponent>);
  data: Transaction = inject(MAT_DIALOG_DATA);

  loading = signal(true);
  saving = signal(false);
  allTransactions = signal<Transaction[]>([]);
  filteredTransactions = signal<Transaction[]>([]);

  searchQuery = '';
  selectedId: number | null = null;
  selectedTransaction: Transaction | null = null;

  get oppositeType(): string {
    return this.data.type === 'expense' ? 'ingreso' : 'gasto';
  }

  get netAmount(): number {
    if (!this.selectedTransaction) return 0;
    const expense = this.data.type === 'expense' ? this.data.amount : this.selectedTransaction.amount;
    const income = this.data.type === 'income' ? this.data.amount : this.selectedTransaction.amount;
    return income - expense;
  }

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    // Load transactions of opposite type that are not already linked
    const oppositeType = this.data.type === 'expense' ? 'income' : 'expense';

    this.apiService.getTransactions({ type: oppositeType }).subscribe({
      next: (transactions) => {
        // Filter out already linked transactions and the current transaction
        const available = transactions.filter(tx =>
          !tx.linked_to && tx.id !== this.data.id
        );
        this.allTransactions.set(available);
        this.filteredTransactions.set(available);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  filterTransactions() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredTransactions.set(this.allTransactions());
    } else {
      this.filteredTransactions.set(
        this.allTransactions().filter(tx =>
          tx.description.toLowerCase().includes(query) ||
          (tx.detail && tx.detail.toLowerCase().includes(query))
        )
      );
    }
  }

  selectTransaction(tx: Transaction) {
    if (this.selectedId === tx.id) {
      this.selectedId = null;
      this.selectedTransaction = null;
    } else {
      this.selectedId = tx.id;
      this.selectedTransaction = tx;
    }
  }

  link() {
    if (!this.selectedId) return;

    this.saving.set(true);
    this.apiService.linkTransactions(this.data.id, this.selectedId).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${day} ${months[monthIndex]}`;
    }
    return dateStr;
  }
}
