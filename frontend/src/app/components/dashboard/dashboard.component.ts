import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
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
import { ApiService } from '../../services/api.service';
import { DashboardSummary, Transaction, CategorySummary, Category } from '../../models/models';
import { TransactionDetailDialogComponent } from '../transactions/transaction-detail-dialog.component';
import { TransactionDialogComponent } from '../transactions/transaction-dialog.component';

interface DateFilter {
  label: string;
  value: string;
  getRange: () => { start: Date; end: Date };
}

interface CategorySummaryWithSubs extends CategorySummary {
  subcategories?: CategorySummary[];
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
    CurrencyPipe,
    DatePipe
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
            @if (selectedCategory()) {
              <span class="filter-chip category" [style.border-color]="selectedCategory()!.color">
                <span class="cat-dot" [style.background-color]="selectedCategory()!.color"></span>
                {{ selectedCategory()!.category_name }}
                <button class="remove-filter" (click)="clearCategoryFilter()">
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

        <!-- Category Breakdown -->
        @if (displayedCategoriesWithSubs().length) {
          <mat-card class="section-card">
            <div class="section-header">
              <h2>{{ selectedType() === 'income' ? 'Ingresos' : 'Gastos' }} por Categoría</h2>
              @if (selectedCategory()) {
                <button mat-button color="primary" (click)="clearCategoryFilter()">
                  Ver todas
                </button>
              }
            </div>
            <div class="category-list">
              @for (cat of visibleCategories(); track cat.category_id) {
                <div class="category-wrapper">
                  <div
                    class="category-item"
                    [class.selected]="selectedCategory()?.category_id === cat.category_id"
                    [class.clickable]="true"
                    [class.has-subs]="cat.subcategories?.length"
                  >
                    @if (cat.subcategories?.length) {
                      <button class="expand-btn" (click)="toggleCategoryExpand(cat.category_id); $event.stopPropagation()">
                        <mat-icon>{{ isCategoryExpanded(cat.category_id) ? 'expand_less' : 'expand_more' }}</mat-icon>
                      </button>
                    }
                    <div class="category-main" (click)="toggleCategoryFilter(cat)">
                      <div class="category-info">
                        <span class="category-color" [style.background-color]="cat.color"></span>
                        <span class="category-name">{{ cat.category_name }}</span>
                        <span class="category-count">{{ cat.count }} mov.</span>
                      </div>
                      <div class="category-bar-container">
                        <div class="category-bar" [style.width.%]="getPercentage(cat.total)" [style.background-color]="cat.color"></div>
                      </div>
                      <span class="category-amount" [class.income]="selectedType() === 'income'">
                        {{ cat.total | currency:'S/':'symbol':'1.0-0' }}
                      </span>
                      @if (selectedCategory()?.category_id === cat.category_id) {
                        <mat-icon class="selected-cat-icon">check_circle</mat-icon>
                      }
                    </div>
                  </div>

                  <!-- Subcategories -->
                  @if (cat.subcategories?.length && isCategoryExpanded(cat.category_id)) {
                    <div class="subcategories-list">
                      @for (sub of cat.subcategories; track sub.category_id) {
                        <div
                          class="category-item subcategory-item"
                          [class.selected]="selectedCategory()?.category_id === sub.category_id"
                          [class.clickable]="true"
                          (click)="toggleCategoryFilter(sub)"
                        >
                          <div class="category-info">
                            <span class="category-color" [style.background-color]="sub.color"></span>
                            <span class="category-name">{{ sub.category_name }}</span>
                            <span class="category-count">{{ sub.count }} mov.</span>
                          </div>
                          <div class="category-bar-container">
                            <div class="category-bar" [style.width.%]="getPercentage(sub.total)" [style.background-color]="sub.color"></div>
                          </div>
                          <span class="category-amount" [class.income]="selectedType() === 'income'">
                            {{ sub.total | currency:'S/':'symbol':'1.0-0' }}
                          </span>
                          @if (selectedCategory()?.category_id === sub.category_id) {
                            <mat-icon class="selected-cat-icon">check_circle</mat-icon>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            @if (hasMoreCategories()) {
              @if (showAllCategories()) {
                <button mat-button color="primary" class="show-more-btn" (click)="toggleShowAllCategories()">
                  <mat-icon>expand_less</mat-icon>
                  Ver menos
                </button>
              } @else {
                <button mat-button color="primary" class="show-more-btn" (click)="toggleShowAllCategories()">
                  <mat-icon>expand_more</mat-icon>
                  Ver más ({{ displayedCategoriesWithSubs().length - 3 }})
                </button>
              }
            }
          </mat-card>
        }

        <!-- Recent Transactions -->
        <mat-card class="section-card">
          <div class="section-header">
            <h2>
              @if (selectedCategory()) {
                Transacciones de {{ selectedCategory()!.category_name }}
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
                  <div class="tx-icon" [style.background-color]="tx.category?.color || '#64748b'">
                    <mat-icon>{{ tx.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
                  </div>
                  <div class="tx-details">
                    <span class="tx-description">{{ tx.description }}</span>
                    <div class="tx-meta">
                      <span class="tx-category">{{ tx.category?.name || 'Sin categoría' }}</span>
                      @if (tx.detail) {
                        <span class="tx-detail-text">• {{ tx.detail }}</span>
                      }
                    </div>
                  </div>
                  <div class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                    {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.amount | currency:'S/':'symbol':'1.0-0' }}
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

    .date-field {
      flex: 1;
      min-width: 140px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
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

      &.category {
        background: white;
        border: 2px solid;
      }

      .cat-dot {
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

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .category-wrapper {
      display: flex;
      flex-direction: column;
    }

    .category-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 8px;
      transition: all 0.2s;
      position: relative;

      &.has-subs {
        padding-left: 0;
      }

      &.clickable {
        cursor: pointer;

        &:hover {
          background: #f8fafc;
        }
      }

      &.selected {
        background: #eef2ff;
        outline: 2px solid #6366f1;
      }

      .selected-cat-icon {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: #6366f1;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .expand-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      color: #64748b;

      &:hover {
        background: #e2e8f0;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .category-main {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
      padding: 4px 8px;
      border-radius: 6px;
      position: relative;

      &:hover {
        background: #f8fafc;
      }
    }

    .subcategories-list {
      margin-left: 32px;
      padding-left: 12px;
      border-left: 2px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }

    .subcategory-item {
      padding: 6px 8px;
      font-size: 0.9rem;

      .category-name {
        font-weight: 400;
      }

      .category-amount {
        font-size: 0.9rem;
      }
    }

    .category-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .category-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .category-name {
      font-weight: 500;
    }

    .category-count {
      font-size: 0.75rem;
      color: #64748b;
    }

    .category-bar-container {
      grid-column: 1 / 2;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .category-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .category-amount {
      font-weight: 600;
      color: #ef4444;
      padding-right: 24px;

      &.income {
        color: #22c55e;
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

      .tx-category {
        font-size: 0.75rem;
        color: #64748b;
      }

      .tx-detail-text {
        font-size: 0.75rem;
        color: #6366f1;
        font-style: italic;
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
  allCategories = signal<Category[]>([]);
  maxExpense = signal(0);
  expandedCategories = signal<Set<number>>(new Set());
  showAllCategories = signal(false);

  // Filter state
  selectedDateFilter = signal<string>('month');
  selectedType = signal<'income' | 'expense' | null>(null);
  selectedCategory = signal<CategorySummary | null>(null);

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
    if (this.selectedCategory()) {
      return this.selectedCategory()!.type === 'income' ? this.selectedCategory()!.total : 0;
    }
    return this.data()?.total_income ?? 0;
  });

  displayedExpense = computed(() => {
    if (this.selectedCategory()) {
      return this.selectedCategory()!.type === 'expense' ? this.selectedCategory()!.total : 0;
    }
    return this.data()?.total_expense ?? 0;
  });

  displayedBalance = computed(() => {
    if (this.selectedCategory()) {
      const cat = this.selectedCategory()!;
      return cat.type === 'income' ? cat.total : -cat.total;
    }
    return this.data()?.balance ?? 0;
  });

  displayedCategories = computed(() => {
    const type = this.selectedType() || 'expense';
    const categories = this.data()?.by_category || [];
    return categories.filter(c => c.type === type);
  });

  displayedCategoriesWithSubs = computed((): CategorySummaryWithSubs[] => {
    const type = this.selectedType() || 'expense';
    const categorySummaries = this.data()?.by_category || [];
    const categories = this.allCategories();

    // Create a map of category id -> category info (to know which are parents/children)
    const categoryMap = new Map<number, Category>();
    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
    }

    // Separate parent summaries from subcategory summaries
    const parentSummaries: CategorySummaryWithSubs[] = [];
    const subcategorySummaries: CategorySummary[] = [];

    for (const cs of categorySummaries) {
      if (cs.type !== type) continue;

      const catInfo = categoryMap.get(cs.category_id);
      if (!catInfo) continue;

      if (catInfo.parent_id) {
        // This is a subcategory
        subcategorySummaries.push(cs);
      } else {
        // This is a parent category
        parentSummaries.push({ ...cs, subcategories: undefined });
      }
    }

    // Now attach subcategories to their parents
    for (const subSummary of subcategorySummaries) {
      const catInfo = categoryMap.get(subSummary.category_id);
      if (!catInfo?.parent_id) continue;

      // Find the parent in our results
      const parentResult = parentSummaries.find(p => p.category_id === catInfo.parent_id);
      if (parentResult) {
        if (!parentResult.subcategories) {
          parentResult.subcategories = [];
        }
        parentResult.subcategories.push(subSummary);
      }
    }

    // Also include parent categories that have no transactions but have subcategories with transactions
    for (const subSummary of subcategorySummaries) {
      const catInfo = categoryMap.get(subSummary.category_id);
      if (!catInfo?.parent_id) continue;

      const parentExists = parentSummaries.find(p => p.category_id === catInfo.parent_id);
      if (!parentExists) {
        // Create a parent entry with zero total
        const parentCat = categoryMap.get(catInfo.parent_id);
        if (parentCat) {
          const newParent: CategorySummaryWithSubs = {
            category_id: parentCat.id,
            category_name: parentCat.name,
            color: parentCat.color,
            type: parentCat.type,
            total: 0,
            count: 0,
            subcategories: [subSummary]
          };
          parentSummaries.push(newParent);
        }
      }
    }

    // Update parent totals to include subcategories
    for (const parent of parentSummaries) {
      if (parent.subcategories?.length) {
        const subsTotal = parent.subcategories.reduce((sum, s) => sum + s.total, 0);
        const subsCount = parent.subcategories.reduce((sum, s) => sum + s.count, 0);
        parent.total += subsTotal;
        parent.count += subsCount;
      }
    }

    // Sort by total descending
    parentSummaries.sort((a, b) => b.total - a.total);

    return parentSummaries;
  });

  visibleCategories = computed(() => {
    const all = this.displayedCategoriesWithSubs();
    if (this.showAllCategories() || all.length <= 3) {
      return all;
    }
    return all.slice(0, 3);
  });

  hasMoreCategories = computed(() => {
    return this.displayedCategoriesWithSubs().length > 3;
  });

  filteredTransactions = computed(() => {
    let transactions = this.allTransactions();

    if (this.selectedType()) {
      transactions = transactions.filter(t => t.type === this.selectedType());
    }

    if (this.selectedCategory()) {
      const selectedCatId = this.selectedCategory()!.category_id;
      // Get subcategory IDs (categories where parent_id equals the selected category)
      const subcategoryIds = this.allCategories()
        .filter(c => c.parent_id === selectedCatId)
        .map(c => c.id);
      const categoryIds = [selectedCatId, ...subcategoryIds];

      transactions = transactions.filter(t => t.category_id && categoryIds.includes(t.category_id));
    }

    return transactions.slice(0, 10);
  });

  hasActiveFilters = computed(() => {
    return this.selectedType() !== null || this.selectedCategory() !== null;
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

    // Load categories for subcategory structure (flat mode to get parent_id for each category)
    this.apiService.getCategoriesFlat().subscribe({
      next: (categories) => this.allCategories.set(categories)
    });

    // Load dashboard summary and transactions in parallel
    this.apiService.getDashboard(startDate, endDate).subscribe({
      next: (data) => {
        this.data.set(data);
        const currentType = this.selectedType() || 'expense';
        const categories = data.by_category.filter(c => c.type === currentType);
        if (categories.length) {
          this.maxExpense.set(Math.max(...categories.map(c => c.total)));
        }
      }
    });

    this.apiService.getTransactions({
      start_date: startDate,
      end_date: endDate
    }).subscribe({
      next: (transactions) => {
        this.allTransactions.set(transactions);
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
      // Clear category filter when changing type
      this.selectedCategory.set(null);
    }
    this.showAllCategories.set(false);
    this.updateMaxExpense();
  }

  toggleCategoryFilter(category: CategorySummary) {
    if (this.selectedCategory()?.category_id === category.category_id) {
      this.selectedCategory.set(null);
    } else {
      this.selectedCategory.set(category);
    }
  }

  clearTypeFilter() {
    this.selectedType.set(null);
    this.selectedCategory.set(null);
    this.updateMaxExpense();
  }

  clearCategoryFilter() {
    this.selectedCategory.set(null);
  }

  clearAllFilters() {
    this.selectedType.set(null);
    this.selectedCategory.set(null);
    this.updateMaxExpense();
  }

  updateMaxExpense() {
    const type = this.selectedType() || 'expense';
    const categories = this.data()?.by_category.filter(c => c.type === type) || [];
    if (categories.length) {
      this.maxExpense.set(Math.max(...categories.map(c => c.total)));
    } else {
      this.maxExpense.set(0);
    }
  }

  getPercentage(amount: number): number {
    if (!this.maxExpense()) return 0;
    return (amount / this.maxExpense()) * 100;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Category expand/collapse
  toggleCategoryExpand(categoryId: number) {
    const expanded = new Set(this.expandedCategories());
    if (expanded.has(categoryId)) {
      expanded.delete(categoryId);
    } else {
      expanded.add(categoryId);
    }
    this.expandedCategories.set(expanded);
  }

  toggleShowAllCategories() {
    this.showAllCategories.set(!this.showAllCategories());
  }

  isCategoryExpanded(categoryId: number): boolean {
    return this.expandedCategories().has(categoryId);
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
      data: { transaction, categories: this.allCategories() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDashboard();
      }
    });
  }
}
