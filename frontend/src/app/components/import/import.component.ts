import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Category, ParsedTransaction, Account } from '../../models/models';
import { CATEGORY_COLORS } from '../categories/category-dialog.component';
import { SplitTransactionDialogComponent, SplitDialogResult } from './split-transaction-dialog.component';

interface Bank {
  id: string;
  name: string;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatRadioModule,
    MatChipsModule,
    MatCheckboxModule,
    MatMenuModule,
    MatDialogModule,
    CurrencyPipe,
    DatePipe,
    RouterLink
  ],
  template: `
    <div class="container">
      <header class="page-header">
        <h1>Importar Archivo</h1>
        <p class="text-muted">Sube un archivo Excel de tu estado de cuenta</p>
      </header>

      @switch (step()) {
        @case (1) {
          <!-- Step 1: Select Bank and Account -->
          @if (accounts().length === 0) {
            <mat-card class="empty-state">
              <mat-icon>account_balance_wallet</mat-icon>
              <h2>Primero crea una cuenta</h2>
              <p>Necesitas tener al menos una cuenta para importar transacciones</p>
              <a mat-raised-button color="primary" routerLink="/accounts">
                <mat-icon>add</mat-icon>
                Crear Cuenta
              </a>
            </mat-card>
          } @else {
            <mat-card class="bank-card">
              <h2>Selecciona banco y cuenta</h2>
              <p class="text-muted">Esto nos ayuda a leer correctamente tu archivo</p>

              <h3 class="section-title">Banco del archivo</h3>
              <div class="bank-list">
                @for (bank of banks(); track bank.id) {
                  <div
                    class="bank-option"
                    [class.selected]="selectedBank() === bank.id"
                    (click)="selectBank(bank.id)"
                  >
                    <div class="bank-icon">
                      @if (bank.id === 'bbva') {
                        <span class="bank-logo bbva">BBVA</span>
                      } @else {
                        <mat-icon>account_balance</mat-icon>
                      }
                    </div>
                    <span class="bank-name">{{ bank.name }}</span>
                    @if (selectedBank() === bank.id) {
                      <mat-icon class="check-icon">check_circle</mat-icon>
                    }
                  </div>
                }
              </div>

              <h3 class="section-title">Cuenta destino</h3>
              <div class="account-list">
                @for (account of accounts(); track account.id) {
                  <div
                    class="account-option"
                    [class.selected]="selectedAccount() === account.id"
                    (click)="selectAccount(account.id)"
                  >
                    <div class="account-icon" [style.background-color]="account.color + '20'">
                      <mat-icon [style.color]="account.color">account_balance_wallet</mat-icon>
                    </div>
                    <div class="account-info">
                      <span class="account-name">{{ account.name }}</span>
                      @if (account.bank) {
                        <span class="account-bank">{{ account.bank }}</span>
                      }
                    </div>
                    <span class="currency-badge">{{ account.currency }}</span>
                    @if (selectedAccount() === account.id) {
                      <mat-icon class="check-icon">check_circle</mat-icon>
                    }
                  </div>
                }
              </div>

              <button
                mat-raised-button
                color="primary"
                class="continue-btn"
                [disabled]="!selectedBank() || !selectedAccount()"
                (click)="step.set(2)"
              >
                Continuar
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </mat-card>
          }
        }

        @case (2) {
          <!-- Step 2: Upload -->
          <mat-card class="upload-card">
            <div class="selected-bank-header">
              <button mat-icon-button (click)="step.set(1)">
                <mat-icon>arrow_back</mat-icon>
              </button>
              <span>Banco: <strong>{{ getSelectedBankName() }}</strong></span>
            </div>

            <div
              class="drop-zone"
              [class.dragover]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
            >
              <input
                #fileInput
                type="file"
                hidden
                accept=".xlsx,.xls,.csv"
                (change)="onFileSelected($event)"
              />

              @if (uploading()) {
                <mat-spinner diameter="48"></mat-spinner>
                <p>Procesando archivo...</p>
              } @else {
                <mat-icon>cloud_upload</mat-icon>
                <p>Arrastra tu archivo Excel aquí o haz clic para seleccionar</p>
                <span class="file-types">Formatos: .xlsx, .xls, .csv</span>
              }
            </div>

            @if (error()) {
              <div class="error-message">
                <mat-icon>error</mat-icon>
                {{ error() }}
              </div>
            }
          </mat-card>

          @if (selectedBank() === 'bbva') {
            <mat-card class="info-card">
              <h3>Formato esperado para BBVA</h3>
              <p>Tu archivo debe tener las columnas:</p>
              <ul>
                <li><strong>Columna B:</strong> FECHA (ej: 16/12/2025)</li>
                <li><strong>Columna C:</strong> DESCRIPCIÓN</li>
                <li><strong>Columna F:</strong> MONTO (ej: S/ -30.00)</li>
              </ul>
              <p class="hint">El encabezado debe estar en la fila 5</p>
            </mat-card>
          }
        }

        @case (3) {
          <!-- Step 3: Categorize -->
          <mat-card class="categorize-card">
            <div class="categorize-header">
              <div class="header-left">
                <h2>Asignar Categorías</h2>
                <p>
                  {{ getNewTransactionsCount() }} nuevas
                  @if (getDuplicatesCount() > 0) {
                    <span class="duplicate-count">• {{ getDuplicatesCount() }} duplicadas</span>
                  }
                </p>
              </div>
              <button mat-stroked-button (click)="showCategoryManager.set(!showCategoryManager())">
                <mat-icon>{{ showCategoryManager() ? 'close' : 'settings' }}</mat-icon>
                {{ showCategoryManager() ? 'Cerrar' : 'Categorías' }}
              </button>
            </div>

            <!-- Category Manager Panel -->
            @if (showCategoryManager()) {
              <div class="category-manager">
                <div class="category-manager-header">
                  <h3>Gestionar Categorías</h3>
                  <button mat-icon-button (click)="openCategoryForm()">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>

                @if (showCategoryForm()) {
                  <div class="category-form">
                    @if (categoryFormData.parent_id) {
                      <div class="parent-info-mini">
                        <span class="parent-label">Subcategoría de:</span>
                        <span class="parent-name">{{ getParentCategoryName(categoryFormData.parent_id) }}</span>
                        <button mat-icon-button class="clear-parent" (click)="categoryFormData.parent_id = null">
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>
                    }

                    <div class="category-form-row">
                      <mat-form-field appearance="outline" class="form-field-sm">
                        <mat-label>Nombre</mat-label>
                        <input matInput [(ngModel)]="categoryFormData.name" placeholder="Ej: Supermercado">
                      </mat-form-field>

                      @if (!categoryFormData.parent_id) {
                        <mat-form-field appearance="outline" class="form-field-sm">
                          <mat-label>Tipo</mat-label>
                          <mat-select [(ngModel)]="categoryFormData.type">
                            <mat-option value="expense">Gasto</mat-option>
                            <mat-option value="income">Ingreso</mat-option>
                          </mat-select>
                        </mat-form-field>
                      }
                    </div>

                    <div class="color-picker-section">
                      <label>Color</label>
                      <div class="color-grid-mini">
                        @for (color of predefinedColors; track color) {
                          <button
                            type="button"
                            class="color-btn-mini"
                            [style.background-color]="color"
                            [class.selected]="categoryFormData.color === color"
                            [class.disabled]="isColorUsed(color)"
                            [disabled]="isColorUsed(color)"
                            [title]="isColorUsed(color) ? 'Color en uso' : ''"
                            (click)="categoryFormData.color = color"
                          >
                            @if (categoryFormData.color === color) {
                              <mat-icon>check</mat-icon>
                            }
                            @if (isColorUsed(color)) {
                              <mat-icon class="used-icon">block</mat-icon>
                            }
                          </button>
                        }
                      </div>
                    </div>

                    <div class="form-actions-inline">
                      <button mat-button (click)="closeCategoryForm()">Cancelar</button>
                      <button mat-raised-button color="primary" (click)="saveCategory()" [disabled]="!categoryFormData.name || savingCategory()">
                        @if (savingCategory()) {
                          <mat-spinner diameter="18"></mat-spinner>
                        } @else {
                          {{ editingCategory() ? 'Guardar' : 'Crear' }}
                        }
                      </button>
                    </div>
                  </div>
                }

                <div class="category-tabs">
                  <button mat-button [class.active]="categoryTab() === 'expense'" (click)="categoryTab.set('expense')">
                    Gastos ({{ getRootCategoriesForType('expense').length }})
                  </button>
                  <button mat-button [class.active]="categoryTab() === 'income'" (click)="categoryTab.set('income')">
                    Ingresos ({{ getRootCategoriesForType('income').length }})
                  </button>
                </div>

                <div class="category-list-manager">
                  @for (cat of getRootCategoriesForType(categoryTab()); track cat.id) {
                    <div class="category-item-manager">
                      <button mat-icon-button class="expand-btn" (click)="toggleCategoryExpand(cat.id)" [class.hidden]="!cat.subcategories?.length">
                        <mat-icon [class.rotated]="isCategoryExpanded(cat.id)">expand_more</mat-icon>
                      </button>
                      <span class="category-color" [style.background-color]="cat.color"></span>
                      <span class="category-name">
                        {{ cat.name }}
                        @if (cat.subcategories?.length) {
                          <span class="subcategory-count">({{ cat.subcategories!.length }})</span>
                        }
                      </span>
                      <button mat-icon-button (click)="openSubcategoryForm(cat)" title="Agregar subcategoría">
                        <mat-icon>add</mat-icon>
                      </button>
                      @if (!cat.is_default) {
                        <button mat-icon-button (click)="editCategory(cat)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteCategory(cat)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      } @else {
                        <span class="default-badge">Default</span>
                      }
                    </div>

                    <!-- Subcategories -->
                    @if (cat.subcategories?.length && isCategoryExpanded(cat.id)) {
                      <div class="subcategories-list">
                        @for (sub of cat.subcategories; track sub.id) {
                          <div class="category-item-manager subcategory-item">
                            <span class="category-color" [style.background-color]="sub.color"></span>
                            <span class="category-name">{{ sub.name }}</span>
                            <button mat-icon-button (click)="editCategory(sub)">
                              <mat-icon>edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" (click)="deleteCategory(sub)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  }
                </div>
              </div>
            }

            <mat-progress-bar
              mode="determinate"
              [value]="categorizedProgress()"
            ></mat-progress-bar>

            <div class="transaction-list">
              @for (tx of parsedTransactions(); track tx.description + tx.amount + tx.date) {
                <div class="tx-item"
                     [class.categorized]="tx.category_id"
                     [class.duplicate]="tx.is_duplicate"
                     [class.suggested]="tx.suggested_category_id && !tx.category_id">

                  @if (tx.is_duplicate) {
                    <mat-checkbox
                      [(ngModel)]="tx.is_duplicate"
                      [ngModelOptions]="{standalone: true}"
                      (change)="toggleDuplicate(tx)"
                      class="skip-checkbox"
                    ></mat-checkbox>
                  }

                  <div class="tx-type-indicator" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                    <mat-icon>{{ tx.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
                  </div>

                  <div class="tx-info">
                    <div class="tx-main">
                      <span class="tx-description">
                        {{ tx.description }}
                        @if (tx.is_duplicate) {
                          <span class="badge duplicate-badge">Duplicado</span>
                        }
                        @if (tx.suggested_category_id && !tx.is_duplicate) {
                          <span class="badge suggested-badge">Sugerido</span>
                        }
                      </span>
                      <span class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                        {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.amount | currency:'S/':'symbol':'1.2-2' }}
                      </span>
                    </div>
                    <div class="tx-secondary">
                      <span class="tx-date">{{ formatDatePeru(tx.date) }}</span>
                    </div>
                    <div class="tx-detail-row">
                      <input
                        class="detail-input"
                        [(ngModel)]="tx.detail"
                        placeholder="Agregar detalle..."
                        [disabled]="tx.is_duplicate === true"
                      >
                    </div>
                  </div>

                  <mat-form-field appearance="outline" class="category-select">
                    <mat-select
                      [(ngModel)]="tx.category_id"
                      placeholder="Categoría"
                      [disabled]="tx.is_duplicate === true"
                    >
                      @for (cat of getCategoriesForType(tx.type); track cat.id) {
                        @if (!cat.parent_id) {
                          <mat-option [value]="cat.id">
                            <span class="category-option">
                              <span class="category-dot" [style.background-color]="cat.color"></span>
                              {{ cat.name }}
                            </span>
                          </mat-option>
                          @if (cat.subcategories?.length) {
                            @for (sub of cat.subcategories; track sub.id) {
                              <mat-option [value]="sub.id" class="subcategory-option">
                                <span class="category-option subcategory">
                                  <span class="category-dot" [style.background-color]="sub.color"></span>
                                  {{ sub.name }}
                                </span>
                              </mat-option>
                            }
                          }
                        }
                      }
                    </mat-select>
                  </mat-form-field>

                  @if (tx.type === 'expense' && !tx.is_duplicate) {
                    <button
                      mat-icon-button
                      class="split-btn"
                      (click)="openSplitDialog(tx)"
                      title="Dividir gasto"
                    >
                      <mat-icon>call_split</mat-icon>
                    </button>
                  }
                </div>
              }
            </div>

            <div class="actions">
              <button mat-button (click)="step.set(2)">
                <mat-icon>arrow_back</mat-icon>
                Volver
              </button>
              <button
                mat-raised-button
                color="primary"
                (click)="confirmImport()"
                [disabled]="saving() || !allCategorized()"
              >
                @if (saving()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>check</mat-icon>
                  Importar {{ getNewTransactionsCount() }} transacciones
                }
              </button>
            </div>
          </mat-card>
        }

        @case (4) {
          <!-- Step 4: Success -->
          <mat-card class="success-card">
            <mat-icon class="success-icon">check_circle</mat-icon>
            <h2>Importación completada</h2>
            <p>Se importaron {{ savedCount() }} transacciones correctamente</p>
            <div class="success-actions">
              <button mat-button (click)="reset()">
                Importar otro archivo
              </button>
              <button mat-raised-button color="primary" routerLink="/transactions">
                Ver transacciones
              </button>
            </div>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
      padding-bottom: 100px;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }
    }

    .bank-card {
      padding: 24px;

      h2 {
        margin: 0 0 4px 0;
        font-size: 1.25rem;
      }
    }

    .bank-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      margin: 24px 0;
    }

    .bank-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;

      &:hover {
        border-color: #6366f1;
        background: #f5f3ff;
      }

      &.selected {
        border-color: #6366f1;
        background: #eef2ff;
      }
    }

    .bank-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #64748b;
      }
    }

    .bank-logo {
      font-weight: 700;
      font-size: 12px;

      &.bbva {
        color: #004481;
      }
    }

    .bank-name {
      font-weight: 500;
      text-align: center;
    }

    .check-icon {
      position: absolute;
      top: 8px;
      right: 8px;
      color: #22c55e;
    }

    .section-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #475569;
      margin: 20px 0 12px 0;
    }

    .account-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .account-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;

      &:hover {
        border-color: #6366f1;
        background: #f5f3ff;
      }

      &.selected {
        border-color: #6366f1;
        background: #eef2ff;
      }
    }

    .account-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .account-info {
      flex: 1;

      .account-name {
        font-weight: 500;
        display: block;
      }

      .account-bank {
        font-size: 0.8rem;
        color: #64748b;
      }
    }

    .currency-badge {
      padding: 4px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #64748b;
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

      h2 {
        margin: 0 0 8px 0;
        color: #334155;
      }

      p {
        color: #64748b;
        margin-bottom: 24px;
      }
    }

    .continue-btn {
      width: 100%;
      height: 48px;
    }

    .upload-card {
      padding: 24px;
      margin-bottom: 16px;
    }

    .selected-bank-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      color: #64748b;

      strong {
        color: #1e293b;
      }
    }

    .drop-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover, &.dragover {
        border-color: #6366f1;
        background: #f5f3ff;
      }

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #94a3b8;
        margin-bottom: 16px;
      }

      p {
        color: #475569;
        margin-bottom: 8px;
      }

      .file-types {
        font-size: 0.8rem;
        color: #94a3b8;
      }
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 8px;
      margin-top: 16px;
    }

    .info-card {
      padding: 20px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 1rem;
      }

      ul {
        margin: 12px 0;
        padding-left: 20px;

        li {
          margin-bottom: 8px;
        }
      }

      .hint {
        font-size: 0.875rem;
        color: #64748b;
        font-style: italic;
      }
    }

    .categorize-card {
      padding: 20px;
    }

    .categorize-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .header-left {
        h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        p {
          color: #64748b;
          margin: 4px 0 0 0;
        }
      }
    }

    .category-manager {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
    }

    .category-manager-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }
    }

    .category-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .category-form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .form-field-sm {
      flex: 1;
      min-width: 120px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .color-picker-section {
      label {
        display: block;
        font-size: 0.8rem;
        color: #64748b;
        margin-bottom: 8px;
      }
    }

    .color-grid-mini {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;
    }

    .color-btn-mini {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
      padding: 0;

      &:hover:not(.disabled) {
        transform: scale(1.15);
      }

      &.selected {
        border-color: #1e293b;
      }

      &.disabled {
        opacity: 0.35;
        cursor: not-allowed;

        .used-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      mat-icon {
        color: white;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .form-actions-inline {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }

    .category-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;

      button {
        color: #64748b;

        &.active {
          color: #6366f1;
          font-weight: 500;
        }
      }
    }

    .category-list-manager {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .category-item-manager {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e2e8f0;

      .expand-btn {
        width: 28px;
        height: 28px;

        mat-icon {
          transition: transform 0.2s;

          &.rotated {
            transform: rotate(180deg);
          }
        }

        &.hidden {
          visibility: hidden;
        }
      }

      .category-color {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .category-name {
        flex: 1;
        font-weight: 500;

        .subcategory-count {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: normal;
        }
      }

      .default-badge {
        font-size: 0.7rem;
        padding: 2px 6px;
        background: #e2e8f0;
        color: #64748b;
        border-radius: 4px;
      }

      button {
        width: 32px;
        height: 32px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    .subcategories-list {
      margin-left: 36px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .subcategory-item {
        background: #f8fafc;
        border-left: 3px solid #e2e8f0;
        padding: 6px 10px;
      }
    }

    .parent-info-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f0f9ff;
      border-radius: 6px;
      border: 1px solid #bae6fd;

      .parent-label {
        font-size: 0.8rem;
        color: #64748b;
      }

      .parent-name {
        font-weight: 500;
        color: #0369a1;
      }

      .clear-parent {
        width: 24px;
        height: 24px;
        margin-left: auto;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    mat-progress-bar {
      margin-bottom: 16px;
      border-radius: 4px;
    }

    .transaction-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .tx-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid transparent;

      &.categorized {
        border-color: #22c55e;
        background: #f0fdf4;
      }

      &.duplicate {
        opacity: 0.6;
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      &.suggested {
        border-color: #f59e0b;
        background: #fffbeb;
      }
    }

    .skip-checkbox {
      flex-shrink: 0;
    }

    .badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      font-weight: 500;
      vertical-align: middle;
    }

    .duplicate-badge {
      background: #94a3b8;
      color: white;
    }

    .suggested-badge {
      background: #f59e0b;
      color: white;
    }

    .duplicate-count {
      color: #94a3b8;
    }

    .tx-type-indicator {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      &.income {
        background: #dcfce7;
        mat-icon { color: #22c55e; }
      }

      &.expense {
        background: #fee2e2;
        mat-icon { color: #ef4444; }
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .tx-info {
      flex: 1;
      min-width: 0;
    }

    .tx-main {
      display: flex;
      justify-content: space-between;
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

    .tx-secondary {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tx-date {
      font-size: 0.75rem;
      color: #64748b;
    }

    .tx-detail-row {
      margin-top: 6px;
    }

    .detail-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #475569;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;

      &::placeholder {
        color: #94a3b8;
        font-style: italic;
      }

      &:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
      }

      &:disabled {
        background: #f1f5f9;
        cursor: not-allowed;
      }
    }

    .category-select {
      width: 150px;
      flex-shrink: 0;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .category-option {
      display: flex;
      align-items: center;
      gap: 8px;

      &.subcategory {
        padding-left: 16px;
        font-size: 0.9em;
      }
    }

    .category-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    ::ng-deep .subcategory-option {
      padding-left: 24px !important;
    }

    .split-btn {
      color: #64748b;
      flex-shrink: 0;

      &:hover {
        color: #6366f1;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }

    .success-card {
      text-align: center;
      padding: 48px 24px;

      .success-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        color: #22c55e;
        margin-bottom: 16px;
      }

      h2 {
        margin: 0 0 8px 0;
      }

      p {
        color: #64748b;
        margin-bottom: 24px;
      }
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
  `]
})
export class ImportComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  step = signal(1);
  uploading = signal(false);
  saving = signal(false);
  error = signal('');
  isDragging = signal(false);

  banks = signal<Bank[]>([]);
  selectedBank = signal<string>('');
  accounts = signal<Account[]>([]);
  selectedAccount = signal<number>(0);

  importId = signal(0);
  parsedTransactions = signal<(ParsedTransaction & { category_id?: number })[]>([]);
  categories = signal<Category[]>([]);
  savedCount = signal(0);

  // Category manager state
  showCategoryManager = signal(false);
  showCategoryForm = signal(false);
  editingCategory = signal<Category | null>(null);
  savingCategory = signal(false);
  categoryTab = signal<'income' | 'expense'>('expense');
  predefinedColors = CATEGORY_COLORS;
  expandedCategoryIds = signal<Set<number>>(new Set());
  categoryFormData = {
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#6366f1',
    parent_id: null as number | null
  };

  ngOnInit() {
    this.loadBanks();
    this.loadAccounts();
    this.apiService.getCategories().subscribe({
      next: (categories) => this.categories.set(categories)
    });
  }

  loadBanks() {
    this.apiService.getBanks().subscribe({
      next: (banks) => this.banks.set(banks),
      error: () => {
        // Fallback if API fails
        this.banks.set([
          { id: 'bbva', name: 'BBVA' },
          { id: 'generic', name: 'Genérico (auto-detectar)' }
        ]);
      }
    });
  }

  loadAccounts() {
    this.apiService.getAccounts().subscribe({
      next: (accounts) => this.accounts.set(accounts)
    });
  }

  selectBank(bankId: string) {
    this.selectedBank.set(bankId);
  }

  selectAccount(accountId: number) {
    this.selectedAccount.set(accountId);
  }

  getSelectedBankName(): string {
    const bank = this.banks().find(b => b.id === this.selectedBank());
    return bank?.name || '';
  }

  getSelectedAccountName(): string {
    const account = this.accounts().find(a => a.id === this.selectedAccount());
    return account?.name || '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
  }

  processFile(file: File) {
    this.uploading.set(true);
    this.error.set('');

    this.apiService.uploadFile(file, this.selectedBank(), this.selectedAccount()).subscribe({
      next: (response) => {
        this.importId.set(response.import_id);

        // Apply suggested categories automatically
        const transactionsWithCategories = response.transactions.map(tx => ({
          ...tx,
          category_id: tx.suggested_category_id || tx.category_id
        }));

        this.parsedTransactions.set(transactionsWithCategories);
        this.uploading.set(false);

        if (response.transactions.length === 0) {
          this.error.set('No se encontraron transacciones en el archivo. Verifica el formato.');
        } else {
          this.step.set(3);
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.error || 'Error al procesar el archivo');
      }
    });
  }

  getCategoriesForType(type: 'income' | 'expense'): Category[] {
    return this.categories().filter(c => c.type === type);
  }

  getRootCategoriesForType(type: 'income' | 'expense'): Category[] {
    return this.categories().filter(c => c.type === type && !c.parent_id);
  }

  getParentCategoryName(parentId: number): string {
    const parent = this.categories().find(c => c.id === parentId);
    return parent?.name || '';
  }

  toggleCategoryExpand(id: number): void {
    const current = this.expandedCategoryIds();
    const newSet = new Set(current);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.expandedCategoryIds.set(newSet);
  }

  isCategoryExpanded(id: number): boolean {
    return this.expandedCategoryIds().has(id);
  }

  isColorUsed(color: string): boolean {
    // Color is not used if it's the current editing category's color
    const currentColor = this.editingCategory()?.color?.toLowerCase();
    if (currentColor === color.toLowerCase()) {
      return false;
    }
    // Check all categories including subcategories
    const allColors = this.getAllUsedColors();
    return allColors.includes(color.toLowerCase());
  }

  getAllUsedColors(): string[] {
    const colors: string[] = [];
    const addColors = (cats: Category[]) => {
      for (const cat of cats) {
        colors.push(cat.color.toLowerCase());
        if (cat.subcategories) {
          addColors(cat.subcategories);
        }
      }
    };
    addColors(this.categories());
    return colors;
  }

  categorizedProgress(): number {
    const nonDuplicates = this.parsedTransactions().filter(t => !t.is_duplicate);
    const total = nonDuplicates.length;
    if (!total) return 0;
    const categorized = nonDuplicates.filter(t => t.category_id).length;
    return (categorized / total) * 100;
  }

  allCategorized(): boolean {
    return this.parsedTransactions()
      .filter(t => !t.is_duplicate)
      .every(t => t.category_id);
  }

  getNewTransactionsCount(): number {
    return this.parsedTransactions().filter(t => !t.is_duplicate).length;
  }

  getDuplicatesCount(): number {
    return this.parsedTransactions().filter(t => t.is_duplicate).length;
  }

  toggleDuplicate(tx: ParsedTransaction & { category_id?: number }): void {
    // Allow user to include duplicates if they want
  }

  formatDatePeru(dateStr: string): string {
    if (!dateStr) return '';
    try {
      // Parse date string manually to avoid timezone issues
      // Expected format: "2025-12-14" (YYYY-MM-DD)
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1; // 0-indexed
        const day = parseInt(parts[2], 10);
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${day} ${months[monthIndex]} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  confirmImport() {
    this.saving.set(true);

    this.apiService.confirmImport(this.importId(), this.selectedAccount(), this.parsedTransactions()).subscribe({
      next: (response) => {
        this.savedCount.set(response.saved);
        this.saving.set(false);
        this.step.set(4);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Error al guardar las transacciones');
      }
    });
  }

  reset() {
    this.step.set(1);
    this.selectedBank.set('');
    this.parsedTransactions.set([]);
    this.importId.set(0);
    this.error.set('');
  }

  // Category management methods
  openCategoryForm() {
    this.editingCategory.set(null);
    // Pick first available color
    const firstAvailable = this.predefinedColors.find(c => !this.isColorUsed(c)) || this.predefinedColors[0];
    this.categoryFormData = {
      name: '',
      type: this.categoryTab(),
      color: firstAvailable,
      parent_id: null
    };
    this.showCategoryForm.set(true);
  }

  openSubcategoryForm(parentCategory: Category) {
    this.editingCategory.set(null);
    const firstAvailable = this.predefinedColors.find(c => !this.isColorUsed(c)) || this.predefinedColors[0];
    this.categoryFormData = {
      name: '',
      type: parentCategory.type,
      color: firstAvailable,
      parent_id: parentCategory.id
    };
    this.showCategoryForm.set(true);
    // Expand the parent category to show the new subcategory
    const current = this.expandedCategoryIds();
    if (!current.has(parentCategory.id)) {
      const newSet = new Set(current);
      newSet.add(parentCategory.id);
      this.expandedCategoryIds.set(newSet);
    }
  }

  closeCategoryForm() {
    this.showCategoryForm.set(false);
    this.editingCategory.set(null);
  }

  editCategory(category: Category) {
    this.editingCategory.set(category);
    this.categoryFormData = {
      name: category.name,
      type: category.type,
      color: category.color,
      parent_id: category.parent_id || null
    };
    this.showCategoryForm.set(true);
  }

  saveCategory() {
    this.savingCategory.set(true);

    const data: any = {
      name: this.categoryFormData.name,
      type: this.categoryFormData.type,
      color: this.categoryFormData.color,
      icon: 'category'
    };

    // Add parent_id if creating a subcategory
    if (this.categoryFormData.parent_id) {
      data.parent_id = this.categoryFormData.parent_id;
    }

    const request = this.editingCategory()
      ? this.apiService.updateCategory(this.editingCategory()!.id, data)
      : this.apiService.createCategory(data);

    request.subscribe({
      next: () => {
        this.savingCategory.set(false);
        this.closeCategoryForm();
        this.loadCategories();
      },
      error: () => {
        this.savingCategory.set(false);
      }
    });
  }

  deleteCategory(category: Category) {
    if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
      this.apiService.deleteCategory(category.id).subscribe({
        next: () => this.loadCategories()
      });
    }
  }

  loadCategories() {
    this.apiService.getCategories().subscribe({
      next: (categories) => this.categories.set(categories)
    });
  }

  openSplitDialog(transaction: ParsedTransaction & { category_id?: number }) {
    const dialogRef = this.dialog.open(SplitTransactionDialogComponent, {
      width: '500px',
      data: {
        transaction,
        categories: this.categories()
      }
    });

    dialogRef.afterClosed().subscribe((result: SplitDialogResult | undefined) => {
      if (result && result.parts) {
        this.splitTransaction(transaction, result.parts);
      }
    });
  }

  splitTransaction(
    originalTransaction: ParsedTransaction & { category_id?: number },
    parts: { amount: number; category_id: number | null; details: string }[]
  ) {
    // Find the index of the original transaction
    const transactions = this.parsedTransactions();
    const index = transactions.findIndex(
      t => t.description === originalTransaction.description &&
           t.amount === originalTransaction.amount &&
           t.date === originalTransaction.date
    );

    if (index === -1) return;

    // Create new transactions from parts
    // Keep the original description (from bank/credit card) and use detail for user notes
    const newTransactions: (ParsedTransaction & { category_id?: number })[] = parts.map((part) => ({
      description: originalTransaction.description,
      detail: part.details || undefined,
      amount: part.amount,
      type: originalTransaction.type,
      date: originalTransaction.date,
      raw_text: originalTransaction.raw_text,
      category_id: part.category_id || undefined
    }));

    // Replace the original transaction with the new parts
    const updatedTransactions = [
      ...transactions.slice(0, index),
      ...newTransactions,
      ...transactions.slice(index + 1)
    ];

    this.parsedTransactions.set(updatedTransactions);
  }
}
