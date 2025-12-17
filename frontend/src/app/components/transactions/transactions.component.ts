import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApiService } from '../../services/api.service';
import { Transaction, Category } from '../../models/models';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { TransactionDetailDialogComponent } from './transaction-detail-dialog.component';

interface DateFilter {
  label: string;
  value: string;
  getRange: () => { start: Date; end: Date };
}

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatMenuModule,
    MatCheckboxModule,
    CurrencyPipe
  ],
  template: `
    <div class="container">
      <header class="page-header">
        <div class="header-title">
          <h1>Transacciones</h1>
          @if (selectedIds().length > 0) {
            <span class="selection-count">{{ selectedIds().length }} seleccionadas</span>
          }
        </div>
        <div class="header-actions">
          @if (selectedIds().length > 0) {
            <button mat-raised-button color="warn" (click)="deleteSelected()">
              <mat-icon>delete</mat-icon>
              Eliminar ({{ selectedIds().length }})
            </button>
            <button mat-button (click)="clearSelection()">Cancelar</button>
          } @else {
            <button mat-raised-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon>
              Nueva
            </button>
          }
        </div>
      </header>

      <!-- Filters -->
      <mat-card class="filters-card">
        <!-- Date Filter Presets -->
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

        <!-- Type and Category Filters -->
        <div class="filters">
          <mat-chip-listbox [value]="filterType" (change)="onFilterChange($event)">
            <mat-chip-option value="">Todos</mat-chip-option>
            <mat-chip-option value="income">Ingresos</mat-chip-option>
            <mat-chip-option value="expense">Gastos</mat-chip-option>
          </mat-chip-listbox>

          <mat-form-field appearance="outline" class="category-filter">
            <mat-label>Categoría</mat-label>
            <mat-select [(value)]="filterCategory" (selectionChange)="loadTransactions()">
              <mat-option [value]="null">Todas</mat-option>
              @for (cat of filteredCategories(); track cat.id) {
                @if (!cat.parent_id) {
                  <mat-option [value]="cat.id">
                    <span class="category-option">
                      <span class="cat-dot" [style.background-color]="cat.color"></span>
                      {{ cat.name }}
                    </span>
                  </mat-option>
                  @if (cat.subcategories?.length) {
                    @for (sub of cat.subcategories; track sub.id) {
                      <mat-option [value]="sub.id" class="subcategory-option">
                        <span class="category-option subcategory">
                          <span class="cat-dot" [style.background-color]="sub.color"></span>
                          {{ sub.name }}
                        </span>
                      </mat-option>
                    }
                  }
                }
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Active Filters Summary -->
        @if (hasActiveFilters()) {
          <div class="active-filters-summary">
            <span class="filter-count">{{ transactions().length }} transacciones encontradas</span>
            <button mat-button color="primary" (click)="clearAllFilters()">
              <mat-icon>clear</mat-icon>
              Limpiar filtros
            </button>
          </div>
        }
      </mat-card>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (!transactions().length) {
        <mat-card class="empty-state">
          <mat-icon>receipt_long</mat-icon>
          <p>No hay transacciones</p>
          <button mat-raised-button color="primary" (click)="openDialog()">
            Crear primera transacción
          </button>
        </mat-card>
      } @else {
        <div class="transaction-list">
          @for (tx of transactions(); track tx.id) {
            <mat-card class="transaction-card" [class.selected]="isSelected(tx.id)">
              <mat-checkbox
                [checked]="isSelected(tx.id)"
                (change)="toggleSelection(tx.id)"
                (click)="$event.stopPropagation()"
                class="tx-checkbox"
              ></mat-checkbox>
              <div class="tx-icon" [style.background-color]="tx.category?.color || '#64748b'" (click)="openDialog(tx)">
                <mat-icon>{{ tx.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
              </div>
              <div class="tx-content" (click)="openDialog(tx)">
                <div class="tx-main">
                  <span class="tx-description">{{ tx.description }}</span>
                  <span class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                    {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.amount | currency:'$':'symbol':'1.0-0' }}
                  </span>
                </div>
                <div class="tx-meta">
                  <span class="tx-category">
                    <span class="category-dot" [style.background-color]="tx.category?.color || '#64748b'"></span>
                    {{ tx.category?.name || 'Sin categoría' }}
                  </span>
                  <span class="tx-date">{{ formatDate(tx.date) }}</span>
                </div>
              </div>
              <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item (click)="openDialog(tx)">
                  <mat-icon>edit</mat-icon>
                  Editar
                </button>
                <button mat-menu-item (click)="deleteTransaction(tx)">
                  <mat-icon>delete</mat-icon>
                  Eliminar
                </button>
              </mat-menu>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
      padding-bottom: 100px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .header-title {
      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }

      .selection-count {
        font-size: 0.875rem;
        color: #6366f1;
        font-weight: 500;
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .filters-card {
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .date-filter-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .preset-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

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

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .category-filter {
      min-width: 180px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .category-option {
      display: flex;
      align-items: center;
      gap: 8px;

      &.subcategory {
        padding-left: 12px;
        font-size: 0.9em;
      }
    }

    .cat-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    ::ng-deep .subcategory-option {
      padding-left: 24px !important;
    }

    .active-filters-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .filter-count {
      font-size: 0.85rem;
      color: #64748b;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #94a3b8;
        margin-bottom: 16px;
      }

      p {
        color: #64748b;
        margin-bottom: 16px;
      }
    }

    .transaction-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .transaction-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: box-shadow 0.2s;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }

    .tx-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: white;
      }
    }

    .tx-content {
      flex: 1;
      min-width: 0;
    }

    .tx-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .tx-description {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tx-amount {
      font-weight: 600;
      white-space: nowrap;

      &.income { color: #22c55e; }
      &.expense { color: #ef4444; }
    }

    .tx-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      font-size: 0.8rem;
      color: #64748b;
    }

    .tx-category {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .category-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .tx-checkbox {
      flex-shrink: 0;
    }

    .transaction-card.selected {
      background: #eef2ff;
      border: 1px solid #6366f1;
    }
  `]
})
export class TransactionsComponent implements OnInit {
  private apiService = inject(ApiService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  selectedIds = signal<number[]>([]);
  selectedDateFilter = signal<string>('all');

  filterType = '';
  filterCategory: number | null = null;
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

  // Filter categories based on selected type
  filteredCategories = computed(() => {
    const cats = this.categories();
    if (!this.filterType) return cats;
    return cats.filter(c => c.type === this.filterType);
  });

  hasActiveFilters = computed(() => {
    return this.filterType !== '' ||
           this.filterCategory !== null ||
           this.selectedDateFilter() !== 'all';
  });

  ngOnInit() {
    this.loadCategories();
    this.loadTransactions();
  }

  loadCategories() {
    this.apiService.getCategories().subscribe({
      next: (categories) => this.categories.set(categories)
    });
  }

  onFilterChange(event: any) {
    this.filterType = event.value || '';
    // Reset category filter if type changes and current category doesn't match
    if (this.filterCategory) {
      const cat = this.categories().find(c => c.id === this.filterCategory);
      if (cat && cat.type !== this.filterType && this.filterType) {
        this.filterCategory = null;
      }
    }
    this.loadTransactions();
  }

  applyDateFilter(filter: DateFilter) {
    this.selectedDateFilter.set(filter.value);
    const range = filter.getRange();
    this.customStartDate = range.start;
    this.customEndDate = range.end;
    this.loadTransactions();
  }

  applyCustomDateRange() {
    if (this.customStartDate && this.customEndDate) {
      this.selectedDateFilter.set('custom');
      this.loadTransactions();
    }
  }

  clearAllFilters() {
    this.filterType = '';
    this.filterCategory = null;
    this.selectedDateFilter.set('all');
    this.customStartDate = null;
    this.customEndDate = null;
    this.loadTransactions();
  }

  loadTransactions() {
    this.loading.set(true);
    const filters: any = {};

    if (this.filterType) filters.type = this.filterType;
    if (this.filterCategory) filters.category_id = this.filterCategory;

    // Add date filters
    if (this.selectedDateFilter() !== 'all' && this.customStartDate && this.customEndDate) {
      filters.start_date = this.formatDateForApi(this.customStartDate);
      filters.end_date = this.formatDateForApi(this.customEndDate);
    }

    this.apiService.getTransactions(filters).subscribe({
      next: (transactions) => {
        this.transactions.set(transactions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  openDialog(transaction?: Transaction) {
    const dialogRef = this.dialog.open(TransactionDialogComponent, {
      width: '400px',
      data: { transaction, categories: this.categories() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTransactions();
      }
    });
  }

  openDetailDialog(transaction: Transaction) {
    const dialogRef = this.dialog.open(TransactionDetailDialogComponent, {
      width: '450px',
      data: transaction
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.openDialog(result.transaction);
      }
    });
  }

  deleteTransaction(tx: Transaction) {
    if (confirm('¿Eliminar esta transacción?')) {
      this.apiService.deleteTransaction(tx.id).subscribe({
        next: () => this.loadTransactions()
      });
    }
  }

  // Batch selection methods
  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelection(id: number) {
    const current = this.selectedIds();
    if (current.includes(id)) {
      this.selectedIds.set(current.filter(i => i !== id));
    } else {
      this.selectedIds.set([...current, id]);
    }
  }

  clearSelection() {
    this.selectedIds.set([]);
  }

  deleteSelected() {
    const count = this.selectedIds().length;
    if (confirm(`¿Eliminar ${count} transacciones seleccionadas?`)) {
      this.apiService.deleteTransactionsBatch(this.selectedIds()).subscribe({
        next: () => {
          this.clearSelection();
          this.loadTransactions();
        }
      });
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    // Parse date string manually to avoid timezone issues
    // Expected format: "2025-12-14" (YYYY-MM-DD)
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${day} ${months[monthIndex]} ${year}`;
    }
    return dateStr;
  }
}
