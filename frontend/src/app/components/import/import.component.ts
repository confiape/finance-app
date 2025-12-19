import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Tag, ParsedTransaction, Account } from '../../models/models';
import { SplitTransactionDialogComponent, SplitDialogResult } from './split-transaction-dialog.component';

export const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#475569'
];

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
    MatChipsModule,
    MatCheckboxModule,
    MatMenuModule,
    MatDialogModule,
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
        }

        @case (3) {
          <!-- Step 3: Assign Tags -->
          <mat-card class="categorize-card">
            <div class="categorize-header">
              <div class="header-left">
                <h2>Asignar Tags</h2>
                <p>
                  {{ getNewTransactionsCount() }} nuevas
                  @if (getDuplicatesCount() > 0) {
                    <span class="duplicate-count">• {{ getDuplicatesCount() }} duplicadas</span>
                  }
                </p>
              </div>
              <button mat-stroked-button (click)="showTagManager.set(!showTagManager())">
                <mat-icon>{{ showTagManager() ? 'close' : 'settings' }}</mat-icon>
                {{ showTagManager() ? 'Cerrar' : 'Tags' }}
              </button>
            </div>

            <!-- Tag Manager Panel -->
            @if (showTagManager()) {
              <div class="tag-manager">
                <div class="tag-manager-header">
                  <h3>Gestionar Tags</h3>
                  <button mat-icon-button (click)="openTagForm()">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>

                @if (showTagForm()) {
                  <div class="tag-form">
                    <div class="tag-form-row">
                      <mat-form-field appearance="outline" class="form-field-sm">
                        <mat-label>Nombre</mat-label>
                        <input matInput [(ngModel)]="tagFormData.name" placeholder="Ej: Supermercado">
                      </mat-form-field>
                    </div>

                    <div class="color-picker-section">
                      <label>Color</label>
                      <div class="color-grid-mini">
                        @for (color of predefinedColors; track color) {
                          <button
                            type="button"
                            class="color-btn-mini"
                            [style.background-color]="color"
                            [class.selected]="tagFormData.color === color"
                            (click)="tagFormData.color = color"
                          >
                            @if (tagFormData.color === color) {
                              <mat-icon>check</mat-icon>
                            }
                          </button>
                        }
                      </div>
                    </div>

                    <div class="form-actions-inline">
                      <button mat-button (click)="closeTagForm()">Cancelar</button>
                      <button mat-raised-button color="primary" (click)="saveTag()" [disabled]="!tagFormData.name || savingTag()">
                        @if (savingTag()) {
                          <mat-spinner diameter="18"></mat-spinner>
                        } @else {
                          {{ editingTag() ? 'Guardar' : 'Crear' }}
                        }
                      </button>
                    </div>
                  </div>
                }

                <div class="tag-list-manager">
                  @for (tag of tags(); track tag.id) {
                    <div class="tag-item-manager">
                      <span class="tag-color" [style.background-color]="tag.color"></span>
                      <span class="tag-name">{{ tag.name }}</span>
                      <button mat-icon-button (click)="editTag(tag)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteTag(tag)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <mat-progress-bar
              mode="determinate"
              [value]="taggedProgress()"
            ></mat-progress-bar>

            <div class="transaction-list">
              @for (tx of parsedTransactions(); track $index) {
                <div class="tx-item"
                     [class.tagged]="tx.tag_ids && tx.tag_ids.length > 0"
                     [class.duplicate]="tx.is_duplicate"
                     [class.suggested]="tx.suggested_tag_ids && tx.suggested_tag_ids.length > 0 && (!tx.tag_ids || tx.tag_ids.length === 0)">

                  @if (tx.is_duplicate) {
                    <mat-checkbox
                      [checked]="tx.is_duplicate"
                      (change)="toggleDuplicateSkip(tx, $event)"
                      class="skip-checkbox"
                      title="Marcar para omitir (duplicado)"
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
                        @if (tx.suggested_tag_ids && tx.suggested_tag_ids.length > 0 && !tx.is_duplicate && (!tx.tag_ids || tx.tag_ids.length === 0)) {
                          <span class="badge suggested-badge">Sugerido</span>
                        }
                      </span>
                      <div class="tx-amount-group">
                        <span class="tx-amount" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                          {{ tx.type === 'expense' ? '-' : '+' }}{{ tx.currency === 'USD' ? 'US$ ' : 'S/ ' }}{{ tx.amount | number:'1.2-2' }}
                        </span>
                        <button
                          mat-icon-button
                          class="currency-toggle"
                          (click)="toggleCurrency(tx); $event.stopPropagation()"
                          [disabled]="tx.is_duplicate === true"
                          title="Cambiar moneda"
                        >
                          <mat-icon>swap_horiz</mat-icon>
                        </button>
                      </div>
                    </div>
                    <div class="tx-secondary">
                      <span class="tx-date">{{ formatDatePeru(tx.date) }}</span>
                      <span class="tx-currency-badge" [class.usd]="tx.currency === 'USD'">{{ tx.currency }}</span>
                    </div>
                    <div class="tx-detail-row">
                      <input
                        class="detail-input"
                        [(ngModel)]="tx.detail"
                        placeholder="Agregar detalle..."
                        [disabled]="tx.is_duplicate === true"
                      >
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
                    <div class="tag-buttons" [class.disabled]="tx.is_duplicate === true">
                      @for (tag of tags(); track tag.id) {
                        <button
                          type="button"
                          class="tag-btn"
                          [class.selected]="tx.tag_ids?.includes(tag.id)"
                          [style.--tag-color]="tag.color"
                          [disabled]="tx.is_duplicate === true"
                          (click)="toggleTag(tx, tag.id)"
                        >
                          <span class="tag-dot" [style.background-color]="tag.color"></span>
                          {{ tag.name }}
                        </button>
                      }
                    </div>
                  </div>

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
                [disabled]="saving()"
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
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
    }

    .bank-card {
      padding: 24px;
      h2 { margin: 0 0 4px 0; font-size: 1.25rem; }
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

      &:hover { border-color: #6366f1; background: #f5f3ff; }
      &.selected { border-color: #6366f1; background: #eef2ff; }
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
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: #64748b; }
    }

    .bank-logo {
      font-weight: 700;
      font-size: 12px;
      &.bbva { color: #004481; }
    }

    .bank-name { font-weight: 500; text-align: center; }
    .check-icon { position: absolute; top: 8px; right: 8px; color: #22c55e; }

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

      &:hover { border-color: #6366f1; background: #f5f3ff; }
      &.selected { border-color: #6366f1; background: #eef2ff; }
    }

    .account-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .account-info {
      flex: 1;
      .account-name { font-weight: 500; display: block; }
      .account-bank { font-size: 0.8rem; color: #64748b; }
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
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: #94a3b8; margin-bottom: 16px; }
      h2 { margin: 0 0 8px 0; color: #334155; }
      p { color: #64748b; margin-bottom: 24px; }
    }

    .continue-btn { width: 100%; height: 48px; }

    .upload-card { padding: 24px; margin-bottom: 16px; }

    .selected-bank-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      color: #64748b;
      strong { color: #1e293b; }
    }

    .drop-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover, &.dragover { border-color: #6366f1; background: #f5f3ff; }
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: #94a3b8; margin-bottom: 16px; }
      p { color: #475569; margin-bottom: 8px; }
      .file-types { font-size: 0.8rem; color: #94a3b8; }
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

    .categorize-card { padding: 20px; }

    .categorize-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .header-left {
        h2 { margin: 0; font-size: 1.25rem; }
        p { color: #64748b; margin: 4px 0 0 0; }
      }
    }

    .tag-manager {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
    }

    .tag-manager-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    }

    .tag-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .tag-form-row { display: flex; flex-wrap: wrap; gap: 12px; }

    .form-field-sm {
      flex: 1;
      min-width: 120px;
      ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    }

    .color-picker-section {
      label { display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 8px; }
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

      &:hover { transform: scale(1.15); }
      &.selected { border-color: #1e293b; }
      mat-icon { color: white; font-size: 16px; width: 16px; height: 16px; }
    }

    .form-actions-inline {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }

    .tag-list-manager {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .tag-item-manager {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e2e8f0;

      .tag-color { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; }
      .tag-name { flex: 1; font-weight: 500; }
      button { width: 32px; height: 32px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    }

    mat-progress-bar { margin-bottom: 16px; border-radius: 4px; }

    .transaction-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .tx-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid transparent;

      &.tagged { border-color: #22c55e; background: #f0fdf4; }
      &.duplicate { opacity: 0.6; background: #f1f5f9; border-color: #94a3b8; }
      &.suggested { border-color: #f59e0b; background: #fffbeb; }
    }

    .skip-checkbox { flex-shrink: 0; }

    .badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      font-weight: 500;
      vertical-align: middle;
    }

    .duplicate-badge { background: #94a3b8; color: white; }
    .suggested-badge { background: #f59e0b; color: white; }
    .duplicate-count { color: #94a3b8; }

    .tx-type-indicator {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      &.income { background: #dcfce7; mat-icon { color: #22c55e; } }
      &.expense { background: #fee2e2; mat-icon { color: #ef4444; } }
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .tx-info { flex: 1; min-width: 0; }
    .tx-main { display: flex; justify-content: space-between; gap: 8px; }
    .tx-description { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tx-amount-group { display: flex; align-items: center; gap: 4px; }

    .tx-amount {
      font-weight: 600;
      white-space: nowrap;
      &.income { color: #22c55e; }
      &.expense { color: #ef4444; }
    }

    .currency-toggle {
      width: 24px;
      height: 24px;
      padding: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
      &:hover mat-icon { color: #6366f1; }
    }

    .tx-secondary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tx-date { font-size: 0.75rem; color: #64748b; }

    .tx-currency-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      background: #e2e8f0;
      color: #64748b;
      &.usd { background: #dbeafe; color: #1d4ed8; }
    }

    .tx-detail-row {
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .detail-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #475569;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;

      &::placeholder { color: #94a3b8; font-style: italic; }
      &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
      &:disabled { background: #f1f5f9; cursor: not-allowed; }
    }

    .tag-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;

      &.disabled {
        opacity: 0.5;
        pointer-events: none;
      }
    }

    .tag-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: white;
      cursor: pointer;
      font-size: 0.75rem;
      font-family: inherit;
      font-weight: 500;
      color: #475569;
      transition: all 0.15s;
      white-space: nowrap;

      &:hover:not(:disabled) {
        border-color: var(--tag-color, #6366f1);
        background: #fafafa;
      }

      &.selected {
        border-color: var(--tag-color, #6366f1);
        background: color-mix(in srgb, var(--tag-color, #6366f1) 15%, white);
        color: #1e293b;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .tag-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    }

    .split-btn {
      color: #64748b;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      &:hover { color: #6366f1; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
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
      .success-icon { font-size: 80px; width: 80px; height: 80px; color: #22c55e; margin-bottom: 16px; }
      h2 { margin: 0 0 8px 0; }
      p { color: #64748b; margin-bottom: 24px; }
    }

    .success-actions { display: flex; justify-content: center; gap: 12px; }
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
  parsedTransactions = signal<(ParsedTransaction & { tag_ids?: number[] })[]>([]);
  tags = signal<Tag[]>([]);
  savedCount = signal(0);

  // Tag manager state
  showTagManager = signal(false);
  showTagForm = signal(false);
  editingTag = signal<Tag | null>(null);
  savingTag = signal(false);
  predefinedColors = TAG_COLORS;
  tagFormData = {
    name: '',
    color: '#6366f1'
  };

  ngOnInit() {
    this.loadBanks();
    this.loadAccounts();
    this.loadTags();
  }

  loadBanks() {
    this.apiService.getBanks().subscribe({
      next: (banks) => this.banks.set(banks),
      error: () => {
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

  loadTags() {
    this.apiService.getTags().subscribe({
      next: (tags) => this.tags.set(tags)
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

        // Apply suggested tags and detail automatically from previous transactions
        const transactionsWithSuggestions = response.transactions.map((tx: any) => ({
          ...tx,
          tag_ids: tx.suggested_tag_ids || tx.tag_ids || [],
          detail: tx.detail || tx.suggested_detail || null
        }));

        // Sort: new transactions first, then duplicates
        transactionsWithSuggestions.sort((a: any, b: any) => {
          if (a.is_duplicate === b.is_duplicate) return 0;
          return a.is_duplicate ? 1 : -1;
        });

        this.parsedTransactions.set(transactionsWithSuggestions);
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

  taggedProgress(): number {
    const nonDuplicates = this.parsedTransactions().filter(t => !t.is_duplicate);
    const total = nonDuplicates.length;
    if (!total) return 100;
    const tagged = nonDuplicates.filter(t => t.tag_ids && t.tag_ids.length > 0).length;
    return (tagged / total) * 100;
  }

  getNewTransactionsCount(): number {
    return this.parsedTransactions().filter(t => !t.is_duplicate).length;
  }

  getDuplicatesCount(): number {
    return this.parsedTransactions().filter(t => t.is_duplicate).length;
  }

  toggleDuplicateSkip(tx: ParsedTransaction & { tag_ids?: number[] }, event: any): void {
    tx.is_duplicate = event.checked;
  }

  toggleCurrency(tx: ParsedTransaction & { tag_ids?: number[] }): void {
    tx.currency = tx.currency === 'PEN' ? 'USD' : 'PEN';
  }

  formatDatePeru(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
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

    const transactionsToSave = this.parsedTransactions().map(tx => ({
      ...tx,
      tag_ids: tx.tag_ids || []
    }));

    this.apiService.confirmImport(this.importId(), this.selectedAccount(), transactionsToSave).subscribe({
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

  // Tag management methods
  openTagForm() {
    this.editingTag.set(null);
    this.tagFormData = {
      name: '',
      color: '#6366f1'
    };
    this.showTagForm.set(true);
  }

  closeTagForm() {
    this.showTagForm.set(false);
    this.editingTag.set(null);
  }

  editTag(tag: Tag) {
    this.editingTag.set(tag);
    this.tagFormData = {
      name: tag.name,
      color: tag.color
    };
    this.showTagForm.set(true);
  }

  saveTag() {
    this.savingTag.set(true);

    const data = {
      name: this.tagFormData.name,
      color: this.tagFormData.color
    };

    const request = this.editingTag()
      ? this.apiService.updateTag(this.editingTag()!.id, data)
      : this.apiService.createTag(data);

    request.subscribe({
      next: () => {
        this.savingTag.set(false);
        this.closeTagForm();
        this.loadTags();
      },
      error: () => {
        this.savingTag.set(false);
      }
    });
  }

  deleteTag(tag: Tag) {
    if (confirm(`¿Eliminar el tag "${tag.name}"?`)) {
      this.apiService.deleteTag(tag.id).subscribe({
        next: () => this.loadTags()
      });
    }
  }

  toggleTag(tx: ParsedTransaction & { tag_ids?: number[] }, tagId: number) {
    if (!tx.tag_ids) {
      tx.tag_ids = [];
    }
    const index = tx.tag_ids.indexOf(tagId);
    if (index === -1) {
      tx.tag_ids = [...tx.tag_ids, tagId];
    } else {
      tx.tag_ids = tx.tag_ids.filter(id => id !== tagId);
    }
  }

  openSplitDialog(transaction: ParsedTransaction & { tag_ids?: number[] }) {
    const dialogRef = this.dialog.open(SplitTransactionDialogComponent, {
      width: '500px',
      data: {
        transaction,
        tags: this.tags()
      }
    });

    dialogRef.afterClosed().subscribe((result: SplitDialogResult | undefined) => {
      if (result && result.parts) {
        this.splitTransaction(transaction, result.parts);
      }
    });
  }

  splitTransaction(
    originalTransaction: ParsedTransaction & { tag_ids?: number[] },
    parts: { amount: number; tag_ids: number[]; details: string }[]
  ) {
    const transactions = this.parsedTransactions();
    const index = transactions.findIndex(
      t => t.description === originalTransaction.description &&
           t.amount === originalTransaction.amount &&
           t.date === originalTransaction.date
    );

    if (index === -1) return;

    const newTransactions: (ParsedTransaction & { tag_ids?: number[] })[] = parts.map((part) => ({
      description: originalTransaction.description,
      detail: part.details || undefined,
      amount: part.amount,
      currency: originalTransaction.currency,
      type: originalTransaction.type,
      date: originalTransaction.date,
      raw_text: originalTransaction.raw_text,
      tag_ids: part.tag_ids
    }));

    const updatedTransactions = [
      ...transactions.slice(0, index),
      ...newTransactions,
      ...transactions.slice(index + 1)
    ];

    this.parsedTransactions.set(updatedTransactions);
  }
}
