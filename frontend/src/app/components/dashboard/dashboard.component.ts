import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../services/api.service';
import { DashboardSummary, Transaction, TagSummary, Tag } from '../../models/models';
import { TransactionDetailDialogComponent } from '../transactions/transaction-detail-dialog.component';
import { TransactionDialogComponent } from '../transactions/transaction-dialog.component';

type SortOption = 'amount_desc' | 'amount_asc' | 'date_desc' | 'date_asc';

interface DateFilter {
  label: string;
  value: string;
  getRange: () => { start: Date; end: Date };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatDialogModule,
    MatSelectModule,
    DatePipe,
    DecimalPipe
  ],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="loading">
          <mat-spinner></mat-spinner>
        </div>
      } @else {
        <header class="page-header">
          <h1>Dashboard</h1>
          <p class="text-muted">Resumen de tus finanzas</p>
        </header>

        <!-- Date Filter -->
        <div class="date-filter-section">
          <div class="preset-filters">
            @for (filter of dateFilters; track filter.value) {
              <button
                mat-stroked-button
                [class.active]="selectedDateFilter() === filter.value"
                (click)="applyDateFilter(filter)"
              >
                {{ filter.label }}
              </button>
            }
          </div>

          <div class="custom-date-range">
            <mat-form-field appearance="outline" class="date-field">
              <mat-label>Desde</mat-label>
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="customStartDate" (dateChange)="applyCustomDateRange()">
              <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="date-field">
              <mat-label>Hasta</mat-label>
              <input matInput [matDatepicker]="endPicker" [(ngModel)]="customEndDate" (dateChange)="applyCustomDateRange()">
              <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Tipo de cuenta</mat-label>
              <mat-select [(ngModel)]="selectedAccountType" (selectionChange)="loadDashboard()">
                <mat-option [value]="null">Todas</mat-option>
                <mat-option value="debit">Débito</mat-option>
                <mat-option value="credit">Crédito</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Ordenar por</mat-label>
              <mat-select [(ngModel)]="selectedSort" (selectionChange)="onSortChange()">
                <mat-option value="amount_desc">Mayor monto</mat-option>
                <mat-option value="amount_asc">Menor monto</mat-option>
                <mat-option value="date_desc">Más reciente</mat-option>
                <mat-option value="date_asc">Más antiguo</mat-option>
              </mat-select>
            </mat-form-field>

            <button
              mat-stroked-button
              class="linked-toggle"
              [class.active]="includeLinked"
              (click)="toggleIncludeLinked()"
              title="Ver transacciones vinculadas (reembolsos)"
            >
              <mat-icon>{{ includeLinked ? 'link' : 'link_off' }}</mat-icon>
              {{ includeLinked ? 'Mostrando todo' : 'Ocultando reembolsos' }}
            </button>
          </div>
        </div>

        <!-- Active Filters Indicator -->
        @if (hasActiveFilters()) {
          <div class="active-filters">
            <span class="filter-label">Filtros activos:</span>
            @if (selectedType()) {
              <span class="filter-chip" [class.income]="selectedType() === 'income'" [class.expense]="selectedType() === 'expense'">
                {{ selectedType() === 'income' ? 'Ingresos' : 'Gastos' }}
                <button class="remove-filter" (click)="clearTypeFilter()">
                  <mat-icon>close</mat-icon>
                </button>
              </span>
            }
            @for (tagId of selectedTagIds(); track tagId) {
              <span class="filter-chip tag" [style.border-color]="getTagById(tagId)?.color">
                <span class="tag-dot" [style.background-color]="getTagById(tagId)?.color"></span>
                {{ getTagById(tagId)?.tag_name }}
                <button class="remove-filter" (click)="removeTagFromFilter(tagId)">
                  <mat-icon>close</mat-icon>
                </button>
              </span>
            }
            <button mat-button color="primary" (click)="clearAllFilters()">
              Limpiar filtros
            </button>
          </div>
        }

        <!-- Summary Cards -->
        <div class="summary-grid">
          <mat-card
            class="summary-card income"
            [class.selected]="selectedType() === 'income'"
            [class.clickable]="true"
            (click)="toggleTypeFilter('income')"
          >
            <mat-icon>trending_up</mat-icon>
            <div class="summary-content">
              <span class="label">Ingresos</span>
              <span class="value">{{ displayedIncome() | currency:'S/':'symbol':'1.0-0' }}</span>
            </div>
            @if (selectedType() === 'income') {
              <mat-icon class="selected-icon">check_circle</mat-icon>
            }
          </mat-card>

          <mat-card
            class="summary-card expense"
            [class.selected]="selectedType() === 'expense'"
            [class.clickable]="true"
            (click)="toggleTypeFilter('expense')"
          >
            <mat-icon>trending_down</mat-icon>
            <div class="summary-content">
              <span class="label">Gastos</span>
              <span class="value">{{ displayedExpense() | currency:'S/':'symbol':'1.0-0' }}</span>
            </div>
            @if (selectedType() === 'expense') {
              <mat-icon class="selected-icon">check_circle</mat-icon>
            }
          </mat-card>

          <mat-card class="summary-card balance" [class.positive]="displayedBalance() >= 0" [class.negative]="displayedBalance() < 0">
            <mat-icon>account_balance</mat-icon>
            <div class="summary-content">
              <span class="label">Balance</span>
              <span class="value">{{ displayedBalance() | currency:'S/':'symbol':'1.0-0' }}</span>
            </div>
          </mat-card>
        </div>

        <!-- Tag Breakdown -->
        @if (displayedTags().length) {
          <mat-card class="section-card">
            <div class="section-header">
              <h2>{{ selectedType() === 'income' ? 'Ingresos' : 'Gastos' }} por Tag</h2>
              @if (selectedTagIds().length) {
                <button mat-button color="primary" (click)="clearTagFilter()">
                  Limpiar ({{ selectedTagIds().length }})
                </button>
              }
            </div>
            <div class="tags-grid">
              @for (tag of displayedTags(); track tag.tag_id + '-' + tag.type) {
                <button
                  class="tag-toggle"
                  [class.selected]="isTagSelected(tag.tag_id)"
                  [style.--tag-color]="tag.color"
                  (click)="toggleTagFilter(tag)"
                >
                  <span class="tag-color-dot" [style.background-color]="tag.color"></span>
                  <span class="tag-label">{{ tag.tag_name }}</span>
                  <span class="tag-stats">
                    @if (tag.total_pen > 0 && tag.total_usd > 0) {
                      <span class="tag-amounts-multi">
                        <span class="tag-amount-value" [class.income]="selectedType() === 'income'">
                          S/ {{ tag.total_pen | number:'1.0-0' }}
                        </span>
                        <span class="tag-amount-value usd" [class.income]="selectedType() === 'income'">
                          US$ {{ tag.total_usd | number:'1.0-0' }}
                        </span>
                      </span>
                    } @else if (tag.total_usd > 0) {
                      <span class="tag-amount-value" [class.income]="selectedType() === 'income'">
                        US$ {{ tag.total_usd | number:'1.0-0' }}
                      </span>
                    } @else {
                      <span class="tag-amount-value" [class.income]="selectedType() === 'income'">
                        S/ {{ tag.total_pen | number:'1.0-0' }}
                      </span>
                    }
                    <span class="tag-count-value">{{ tag.count }}</span>
                  </span>
                  @if (isTagSelected(tag.tag_id)) {
                    <mat-icon class="check-icon">check</mat-icon>
                  }
                </button>
              }
            </div>
          </mat-card>
        }

        <!-- Recent Transactions -->
        <mat-card class="section-card">
          <div class="section-header">
            <h2>
              @if (selectedTagIds().length) {
                Transacciones filtradas
              } @else if (selectedType()) {
                {{ selectedType() === 'income' ? 'Últimos Ingresos' : 'Últimos Gastos' }}
              } @else {
                Últimas Transacciones
              }
            </h2>
            <a mat-button color="primary" routerLink="/transactions">Ver todas</a>
          </div>

          @if (!filteredTransactions().length) {
            <div class="empty-state">
              <mat-icon>receipt_long</mat-icon>
              <p>
                @if (hasActiveFilters()) {
                  No hay transacciones con los filtros seleccionados
                } @else {
                  No hay transacciones aún
                }
              </p>
              @if (!hasActiveFilters()) {
                <a mat-raised-button color="primary" routerLink="/import">Importar archivo</a>
              }
            </div>
          } @else {
            <div class="transaction-list">
              @for (tx of filteredTransactions(); track tx.id) {
                <div class="transaction-item clickable" (click)="openTransactionDetail(tx)">
                  <div class="tx-icon" [style.background-color]="tx.tags?.[0]?.color || '#64748b'">
                    <mat-icon>{{ tx.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
                  </div>
                  <div class="tx-details">
                    <span class="tx-description">{{ tx.detail || tx.description }}</span>
                    <div class="tx-meta">
                      @if (tx.tags?.length) {
                        @for (tag of tx.tags; track tag.id) {
                          <span class="tx-tag" [style.background-color]="tag.color">{{ tag.name }}</span>
                        }
                      } @else {
                        <span class="tx-tag-empty">Sin tags</span>
                      }
                    </div>
                  </div>
                  <div class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                    {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.currency === 'USD' ? 'US$ ' : 'S/ ' }}{{ tx.amount | number:'1.2-2' }}
                  </div>
                  <mat-icon class="tx-chevron">chevron_right</mat-icon>
                </div>
              }
            </div>
          }
        </mat-card>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <a mat-fab extended color="primary" routerLink="/import">
            <mat-icon>upload_file</mat-icon>
            Importar archivo
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
      padding-bottom: 100px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .page-header {
      margin-bottom: 16px;

      h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 600;
      }
    }

    .date-filter-section {
      margin-bottom: 16px;
    }

    .preset-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;

      button {
        font-size: 0.8rem;
        padding: 0 12px;
        height: 32px;

        &.active {
          background: #6366f1;
          color: white;
          border-color: #6366f1;
        }
      }
    }

    .custom-date-range {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .date-field, .filter-field {
      flex: 1;
      min-width: 140px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .filter-field {
      min-width: 130px;
    }

    .linked-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      font-size: 0.85rem;
      padding: 0 12px;
      height: 56px;
      border-color: #e2e8f0;
      color: #64748b;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &.active {
        background: #6366f1;
        color: white;
        border-color: #6366f1;
      }
    }

    .active-filters {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .filter-label {
      font-size: 0.85rem;
      color: #64748b;
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 12px;
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 500;

      &.income {
        background: #dcfce7;
        color: #166534;
      }

      &.expense {
        background: #fee2e2;
        color: #991b1b;
      }

      &.tag {
        background: white;
        border: 2px solid;
      }

      .tag-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .remove-filter {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #64748b;
        }

        &:hover mat-icon {
          color: #1e293b;
        }
      }
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .summary-card {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      transition: all 0.2s;

      &.clickable {
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      }

      &.selected {
        outline: 3px solid;
        outline-offset: -3px;
      }

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .selected-icon {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      &.income {
        mat-icon { color: #22c55e; }
        .value { color: #22c55e; }
        &.selected { outline-color: #22c55e; }
      }

      &.expense {
        mat-icon { color: #ef4444; }
        .value { color: #ef4444; }
        &.selected { outline-color: #ef4444; }
      }

      &.balance.positive {
        mat-icon { color: #22c55e; }
        .value { color: #22c55e; }
      }

      &.balance.negative {
        mat-icon { color: #ef4444; }
        .value { color: #ef4444; }
      }

      .summary-content {
        display: flex;
        flex-direction: column;

        .label {
          font-size: 0.75rem;
          color: #64748b;
          text-transform: uppercase;
        }

        .value {
          font-size: 1.25rem;
          font-weight: 600;
        }
      }
    }

    .section-card {
      padding: 20px;
      margin-bottom: 16px;

      h2 {
        margin: 0 0 16px 0;
        font-size: 1.125rem;
        font-weight: 600;
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h2 { margin: 0; }
    }

    .tags-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 2px solid #e2e8f0;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      font-size: 0.9rem;

      &:hover {
        border-color: var(--tag-color, #6366f1);
        background: #fafafa;
      }

      &.selected {
        border-color: var(--tag-color, #6366f1);
        background: color-mix(in srgb, var(--tag-color, #6366f1) 10%, white);
      }

      .tag-color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .tag-label {
        font-weight: 500;
        color: #1e293b;
      }

      .tag-stats {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: 4px;
      }

      .tag-amounts-multi {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }

      .tag-amount-value {
        font-weight: 600;
        color: #ef4444;
        font-size: 0.85rem;

        &.income {
          color: #22c55e;
        }

        &.usd {
          font-size: 0.75rem;
          opacity: 0.8;
        }
      }

      .tag-count-value {
        font-size: 0.75rem;
        color: #94a3b8;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 10px;
      }

      .check-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--tag-color, #6366f1);
        margin-left: -4px;
      }
    }

    .show-more-btn {
      width: 100%;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }

      p { margin-bottom: 16px; }
    }

    .transaction-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .transaction-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-bottom: 1px solid #f1f5f9;
      border-radius: 8px;
      margin: 0 -8px;

      &:last-child { border-bottom: none; }

      &.clickable {
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #f8fafc;
          transform: translateX(4px);

          .tx-chevron {
            opacity: 1;
            transform: translateX(0);
          }
        }
      }
    }

    .tx-chevron {
      color: #94a3b8;
      font-size: 20px;
      width: 20px;
      height: 20px;
      opacity: 0;
      transform: translateX(-8px);
      transition: all 0.2s;
    }

    .tx-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: white;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .tx-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;

      .tx-description {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tx-meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .tx-tag {
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
      }

      .tx-tag-empty {
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }

    .tx-amount {
      font-weight: 600;
      white-space: nowrap;

      &.income { color: #22c55e; }
      &.expense { color: #ef4444; }
    }

    .quick-actions {
      position: fixed;
      bottom: 90px;
      right: 16px;
      z-index: 100;

      @media (min-width: 768px) {
        bottom: 24px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  data = signal<DashboardSummary | null>(null);
  allTransactions = signal<Transaction[]>([]);
  allTags = signal<Tag[]>([]);
  maxExpense = signal(0);

  // Filter state
  selectedDateFilter = signal<string>('month');
  selectedType = signal<'income' | 'expense' | null>(null);
  selectedTagIds = signal<number[]>([]);
  selectedAccountType: string | null = null;
  selectedSort: SortOption = 'date_desc';
  includeLinked = false; // Default: hide linked transactions (show net amounts)

  // Custom date range
  customStartDate: Date | null = null;
  customEndDate: Date | null = null;

  // Preset date filters
  dateFilters: DateFilter[] = [
    {
      label: 'Hoy',
      value: 'today',
      getRange: () => {
        const today = new Date();
        return { start: today, end: today };
      }
    },
    {
      label: 'Esta semana',
      value: 'week',
      getRange: () => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        return { start, end: today };
      }
    },
    {
      label: 'Este mes',
      value: 'month',
      getRange: () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start, end: today };
      }
    },
    {
      label: 'Últimos 3 meses',
      value: '3months',
      getRange: () => {
        const today = new Date();
        const start = new Date(today);
        start.setMonth(today.getMonth() - 3);
        return { start, end: today };
      }
    },
    {
      label: 'Este año',
      value: 'year',
      getRange: () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), 0, 1);
        return { start, end: today };
      }
    },
    {
      label: 'Todo',
      value: 'all',
      getRange: () => {
        return { start: new Date(2000, 0, 1), end: new Date() };
      }
    }
  ];

  // Computed values for displayed data
  displayedIncome = computed(() => {
    const selectedIds = this.selectedTagIds();
    if (selectedIds.length) {
      const tags = this.data()?.by_tag || [];
      return tags
        .filter(t => t.type === 'income' && selectedIds.includes(t.tag_id))
        .reduce((sum, t) => sum + t.total, 0);
    }
    return this.data()?.total_income ?? 0;
  });

  displayedExpense = computed(() => {
    const selectedIds = this.selectedTagIds();
    if (selectedIds.length) {
      const tags = this.data()?.by_tag || [];
      return tags
        .filter(t => t.type === 'expense' && selectedIds.includes(t.tag_id))
        .reduce((sum, t) => sum + t.total, 0);
    }
    return this.data()?.total_expense ?? 0;
  });

  displayedBalance = computed(() => {
    const selectedIds = this.selectedTagIds();
    if (selectedIds.length) {
      return this.displayedIncome() - this.displayedExpense();
    }
    return this.data()?.balance ?? 0;
  });

  displayedTags = computed(() => {
    const type = this.selectedType() || 'expense';
    const tags = this.data()?.by_tag || [];
    return tags.filter(t => t.type === type);
  });

  filteredTransactions = computed(() => {
    let transactions = [...this.allTransactions()];

    if (this.selectedType()) {
      transactions = transactions.filter(t => t.type === this.selectedType());
    }

    const selectedIds = this.selectedTagIds();
    if (selectedIds.length) {
      transactions = transactions.filter(t =>
        t.tags?.some(tag => selectedIds.includes(tag.id))
      );
    }

    // Apply sorting
    transactions = this.sortTransactions(transactions);

    return transactions.slice(0, 10);
  });

  hasActiveFilters = computed(() => {
    return this.selectedType() !== null || this.selectedTagIds().length > 0;
  });

  ngOnInit() {
    this.applyDateFilter(this.dateFilters.find(f => f.value === 'month')!);
  }

  applyDateFilter(filter: DateFilter) {
    this.selectedDateFilter.set(filter.value);
    const range = filter.getRange();
    this.customStartDate = range.start;
    this.customEndDate = range.end;
    this.loadDashboard();
  }

  applyCustomDateRange() {
    if (this.customStartDate && this.customEndDate) {
      this.selectedDateFilter.set('custom');
      this.loadDashboard();
    }
  }

  loadDashboard() {
    this.loading.set(true);

    const startDate = this.customStartDate ? this.formatDate(this.customStartDate) : undefined;
    const endDate = this.customEndDate ? this.formatDate(this.customEndDate) : undefined;

    // Load tags for reference
    this.apiService.getTags().subscribe({
      next: (tags) => this.allTags.set(tags)
    });

    // Load dashboard summary and transactions in parallel
    this.apiService.getDashboard(startDate, endDate, this.selectedAccountType || undefined, this.includeLinked).subscribe({
      next: (data) => {
        this.data.set(data);
        const currentType = this.selectedType() || 'expense';
        const tags = data.by_tag.filter(t => t.type === currentType);
        if (tags.length) {
          this.maxExpense.set(Math.max(...tags.map(t => t.total)));
        }
      }
    });

    this.apiService.getTransactions({
      start_date: startDate,
      end_date: endDate,
      account_type: this.selectedAccountType || undefined
    }).subscribe({
      next: (transactions) => {
        this.allTransactions.set(this.sortTransactions(transactions));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  toggleTypeFilter(type: 'income' | 'expense') {
    if (this.selectedType() === type) {
      this.selectedType.set(null);
    } else {
      this.selectedType.set(type);
      // Clear tag filter when changing type
      this.selectedTagIds.set([]);
    }
    this.updateMaxExpense();
  }

  toggleTagFilter(tag: TagSummary) {
    const currentIds = this.selectedTagIds();
    if (currentIds.includes(tag.tag_id)) {
      this.selectedTagIds.set(currentIds.filter(id => id !== tag.tag_id));
    } else {
      this.selectedTagIds.set([...currentIds, tag.tag_id]);
    }
  }

  isTagSelected(tagId: number): boolean {
    return this.selectedTagIds().includes(tagId);
  }

  getTagById(tagId: number): TagSummary | undefined {
    const type = this.selectedType() || 'expense';
    // First try to find the tag matching the current type
    const tagWithType = this.data()?.by_tag.find(t => t.tag_id === tagId && t.type === type);
    if (tagWithType) return tagWithType;
    // Fallback to any tag with this ID
    return this.data()?.by_tag.find(t => t.tag_id === tagId);
  }

  removeTagFromFilter(tagId: number) {
    this.selectedTagIds.set(this.selectedTagIds().filter(id => id !== tagId));
  }

  clearTypeFilter() {
    this.selectedType.set(null);
    this.selectedTagIds.set([]);
    this.updateMaxExpense();
  }

  clearTagFilter() {
    this.selectedTagIds.set([]);
  }

  clearAllFilters() {
    this.selectedType.set(null);
    this.selectedTagIds.set([]);
    this.updateMaxExpense();
  }

  updateMaxExpense() {
    const type = this.selectedType() || 'expense';
    const tags = this.data()?.by_tag.filter(t => t.type === type) || [];
    if (tags.length) {
      this.maxExpense.set(Math.max(...tags.map(t => t.total)));
    } else {
      this.maxExpense.set(0);
    }
  }

  getPercentage(amount: number): number {
    if (!this.maxExpense()) return 0;
    return (amount / this.maxExpense()) * 100;
  }

  // Sorting
  sortTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.sort((a, b) => {
      switch (this.selectedSort) {
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        default:
          return b.amount - a.amount;
      }
    });
  }

  onSortChange() {
    // Force recompute of filteredTransactions by triggering a signal update
    this.allTransactions.set([...this.allTransactions()]);
  }

  toggleIncludeLinked() {
    this.includeLinked = !this.includeLinked;
    this.loadDashboard();
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Transaction detail dialog
  openTransactionDetail(transaction: Transaction) {
    const dialogRef = this.dialog.open(TransactionDetailDialogComponent, {
      width: '450px',
      data: transaction
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.openEditDialog(result.transaction);
      }
    });
  }

  openEditDialog(transaction: Transaction) {
    const dialogRef = this.dialog.open(TransactionDialogComponent, {
      width: '400px',
      data: { transaction, tags: this.allTags() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDashboard();
      }
    });
  }
}
