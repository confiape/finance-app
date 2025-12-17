import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';
import { Account, AccountBalance } from '../../models/models';

@Component({
  selector: 'app-accounts',
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
    MatDialogModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    CurrencyPipe
  ],
  template: `
    <div class="container">
      <header class="page-header">
        <div>
          <h1>Mis Cuentas</h1>
          <p class="text-muted">Administra tus cuentas bancarias y de efectivo</p>
        </div>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon>
          Nueva Cuenta
        </button>
      </header>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (accounts().length === 0) {
        <mat-card class="empty-state">
          <mat-icon>account_balance_wallet</mat-icon>
          <h2>No tienes cuentas</h2>
          <p>Crea tu primera cuenta para comenzar a registrar transacciones</p>
          <button mat-raised-button color="primary" (click)="openForm()">
            <mat-icon>add</mat-icon>
            Crear Cuenta
          </button>
        </mat-card>
      } @else {
        <div class="accounts-grid">
          @for (account of accounts(); track account.id) {
            <mat-card class="account-card" [style.border-left-color]="account.color">
              <div class="account-header">
                <div class="account-icon" [style.background-color]="account.color + '20'">
                  <mat-icon [style.color]="account.color">account_balance</mat-icon>
                </div>
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openForm(account)">
                    <mat-icon>edit</mat-icon>
                    <span>Editar</span>
                  </button>
                  <button mat-menu-item (click)="deleteAccount(account)">
                    <mat-icon>delete</mat-icon>
                    <span>Eliminar</span>
                  </button>
                </mat-menu>
              </div>

              <div class="account-info">
                <h3>{{ account.name }}</h3>
                @if (account.bank) {
                  <span class="bank-name">
                    {{ account.bank }}
                    @if (account.account_type === 'credit') {
                      <span class="credit-badge">Crédito</span>
                    }
                  </span>
                }
                @if (account.account_number) {
                  <span class="account-number">{{ maskAccountNumber(account.account_number) }}</span>
                }
              </div>

              <div class="account-balance">
                @if (balances()[account.id]) {
                  <div class="balance-row">
                    <span class="label">Balance:</span>
                    <span class="amount" [class.positive]="balances()[account.id].balance >= 0" [class.negative]="balances()[account.id].balance < 0">
                      {{ account.currency }} {{ balances()[account.id].balance | number:'1.2-2' }}
                    </span>
                  </div>
                  <div class="balance-details">
                    <span class="income">
                      <mat-icon>arrow_downward</mat-icon>
                      {{ balances()[account.id].income | number:'1.2-2' }}
                    </span>
                    <span class="expense">
                      <mat-icon>arrow_upward</mat-icon>
                      {{ balances()[account.id].expense | number:'1.2-2' }}
                    </span>
                  </div>
                } @else {
                  <mat-spinner diameter="20"></mat-spinner>
                }
              </div>

              <div class="account-currency">
                <span class="currency-badge">{{ account.currency }}</span>
              </div>
            </mat-card>
          }
        </div>
      }

      <!-- Form Dialog -->
      @if (showForm()) {
        <div class="dialog-overlay" (click)="closeForm()">
          <mat-card class="dialog-card" (click)="$event.stopPropagation()">
            <h2>{{ editingAccount() ? 'Editar Cuenta' : 'Nueva Cuenta' }}</h2>

            <form (ngSubmit)="saveAccount()">
              <mat-form-field appearance="outline">
                <mat-label>Nombre de la cuenta</mat-label>
                <input matInput [(ngModel)]="formData.name" name="name" required placeholder="Ej: BBVA Ahorros">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Banco (opcional)</mat-label>
                <mat-select [(ngModel)]="formData.bank" name="bank">
                  <mat-option value="">Sin banco</mat-option>
                  <mat-option value="BBVA">BBVA</mat-option>
                  <mat-option value="BCP">BCP</mat-option>
                  <mat-option value="Interbank">Interbank</mat-option>
                  <mat-option value="Scotiabank">Scotiabank</mat-option>
                  <mat-option value="BanBif">BanBif</mat-option>
                  <mat-option value="Otro">Otro</mat-option>
                </mat-select>
              </mat-form-field>

              @if (formData.bank === 'BBVA') {
                <mat-form-field appearance="outline">
                  <mat-label>Tipo de cuenta</mat-label>
                  <mat-select [(ngModel)]="formData.account_type" name="account_type" required>
                    <mat-option value="debit">Débito / Ahorros</mat-option>
                    <mat-option value="credit">Tarjeta de Crédito</mat-option>
                  </mat-select>
                  <mat-hint>Las tarjetas de crédito invierten los signos al importar</mat-hint>
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Moneda</mat-label>
                <mat-select [(ngModel)]="formData.currency" name="currency" required>
                  <mat-option value="PEN">PEN - Soles</mat-option>
                  <mat-option value="USD">USD - Dólares</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Número de cuenta (opcional)</mat-label>
                <input matInput [(ngModel)]="formData.account_number" name="account_number" placeholder="Últimos 4 dígitos">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Color</mat-label>
                <input matInput type="color" [(ngModel)]="formData.color" name="color">
              </mat-form-field>

              <div class="form-actions">
                <button mat-button type="button" (click)="closeForm()">Cancelar</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="saving() || !formData.name">
                  @if (saving()) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    {{ editingAccount() ? 'Guardar' : 'Crear' }}
                  }
                </button>
              </div>
            </form>
          </mat-card>
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
      align-items: flex-start;
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;

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

    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .account-card {
      padding: 20px;
      border-left: 4px solid;
    }

    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .account-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .account-info {
      margin-bottom: 16px;

      h3 {
        margin: 0 0 4px 0;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .bank-name {
        display: block;
        color: #64748b;
        font-size: 0.875rem;

        .credit-badge {
          display: inline-block;
          margin-left: 6px;
          padding: 2px 6px;
          background: #fef3c7;
          color: #d97706;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
        }
      }

      .account-number {
        display: block;
        color: #94a3b8;
        font-size: 0.8rem;
        font-family: monospace;
      }
    }

    .account-balance {
      margin-bottom: 12px;
    }

    .balance-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .label {
        color: #64748b;
      }

      .amount {
        font-size: 1.25rem;
        font-weight: 600;

        &.positive { color: #22c55e; }
        &.negative { color: #ef4444; }
      }
    }

    .balance-details {
      display: flex;
      gap: 16px;
      font-size: 0.8rem;

      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .income {
        color: #22c55e;
      }

      .expense {
        color: #ef4444;
      }
    }

    .account-currency {
      .currency-badge {
        display: inline-block;
        padding: 4px 8px;
        background: #f1f5f9;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
      }
    }

    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .dialog-card {
      width: 100%;
      max-width: 400px;
      padding: 24px;

      h2 {
        margin: 0 0 24px 0;
      }

      mat-form-field {
        width: 100%;
        margin-bottom: 8px;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `]
})
export class AccountsComponent implements OnInit {
  private apiService = inject(ApiService);

  accounts = signal<Account[]>([]);
  balances = signal<Record<number, AccountBalance>>({});
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingAccount = signal<Account | null>(null);

  formData = {
    name: '',
    bank: '',
    account_type: 'debit' as 'debit' | 'credit',
    currency: 'PEN',
    account_number: '',
    color: '#6366f1'
  };

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.loading.set(true);
    this.apiService.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
        // Load balances for each account
        accounts.forEach(acc => this.loadBalance(acc.id));
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadBalance(accountId: number) {
    this.apiService.getAccountBalance(accountId).subscribe({
      next: (balance) => {
        this.balances.update(b => ({ ...b, [accountId]: balance }));
      }
    });
  }

  maskAccountNumber(number: string): string {
    if (number.length <= 4) return number;
    return '****' + number.slice(-4);
  }

  openForm(account?: Account) {
    if (account) {
      this.editingAccount.set(account);
      this.formData = {
        name: account.name,
        bank: account.bank || '',
        account_type: account.account_type || 'debit',
        currency: account.currency,
        account_number: account.account_number || '',
        color: account.color
      };
    } else {
      this.editingAccount.set(null);
      this.formData = {
        name: '',
        bank: '',
        account_type: 'debit',
        currency: 'PEN',
        account_number: '',
        color: '#6366f1'
      };
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingAccount.set(null);
  }

  saveAccount() {
    this.saving.set(true);

    const data: Partial<Account> = {
      name: this.formData.name,
      bank: this.formData.bank || undefined,
      account_type: this.formData.account_type,
      currency: this.formData.currency,
      account_number: this.formData.account_number || undefined,
      color: this.formData.color
    };

    const request = this.editingAccount()
      ? this.apiService.updateAccount(this.editingAccount()!.id, data)
      : this.apiService.createAccount(data);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.loadAccounts();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  deleteAccount(account: Account) {
    if (confirm(`¿Eliminar la cuenta "${account.name}"?`)) {
      this.apiService.deleteAccount(account.id).subscribe({
        next: () => this.loadAccounts()
      });
    }
  }
}
