import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Transaction } from '../../models/models';

@Component({
  selector: 'app-transaction-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    CurrencyPipe,
    DatePipe
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header" [class.income]="data.type === 'income'" [class.expense]="data.type === 'expense'">
        <div class="type-icon">
          <mat-icon>{{ data.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
        </div>
        <div class="amount">
          {{ data.type === 'expense' ? '-' : '+' }}{{ data.amount | currency:'S/':'symbol':'1.2-2' }}
        </div>
        <div class="type-label">{{ data.type === 'income' ? 'Ingreso' : 'Gasto' }}</div>
      </div>

      <mat-dialog-content>
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">
              <mat-icon>description</mat-icon>
              Descripción
            </span>
            <span class="detail-value">{{ data.description }}</span>
          </div>

          @if (data.detail) {
            <div class="detail-row">
              <span class="detail-label">
                <mat-icon>notes</mat-icon>
                Detalle
              </span>
              <span class="detail-value detail-text">{{ data.detail }}</span>
            </div>
          }

          <div class="detail-row">
            <span class="detail-label">
              <mat-icon>calendar_today</mat-icon>
              Fecha
            </span>
            <span class="detail-value">{{ formatDate(data.date) }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">
              <mat-icon>sell</mat-icon>
              Tags
            </span>
            <span class="detail-value">
              @if (data.tags?.length) {
                <div class="tags-list">
                  @for (tag of data.tags; track tag.id) {
                    <span class="tag-badge" [style.background-color]="tag.color">
                      {{ tag.name }}
                    </span>
                  }
                </div>
              } @else {
                <span class="no-tags">Sin tags</span>
              }
            </span>
          </div>

          <div class="detail-row">
            <span class="detail-label">
              <mat-icon>source</mat-icon>
              Origen
            </span>
            <span class="detail-value source-badge">
              @switch (data.source) {
                @case ('manual') {
                  <mat-icon>edit</mat-icon> Manual
                }
                @case ('import') {
                  <mat-icon>upload_file</mat-icon> Importado
                }
                @default {
                  {{ data.source }}
                }
              }
            </span>
          </div>

          <div class="detail-row meta-row">
            <span class="meta-item">
              <mat-icon>schedule</mat-icon>
              Creado: {{ data.created_at | date:'dd/MM/yyyy HH:mm' }}
            </span>
            @if (data.updated_at !== data.created_at) {
              <span class="meta-item">
                <mat-icon>update</mat-icon>
                Actualizado: {{ data.updated_at | date:'dd/MM/yyyy HH:mm' }}
              </span>
            }
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cerrar</button>
        <button mat-raised-button color="primary" (click)="edit()">
          <mat-icon>edit</mat-icon>
          Editar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 350px;
      max-width: 450px;
    }

    .dialog-header {
      padding: 24px;
      text-align: center;
      border-radius: 8px 8px 0 0;
      margin: -24px -24px 0 -24px;

      &.income {
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        .type-icon { background: #22c55e; }
        .amount { color: #166534; }
      }

      &.expense {
        background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
        .type-icon { background: #ef4444; }
        .amount { color: #991b1b; }
      }
    }

    .type-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;

      mat-icon {
        color: white;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    .amount {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .type-label {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    mat-dialog-content {
      padding-top: 20px !important;
    }

    .detail-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .detail-value {
      font-size: 1rem;
      color: #1e293b;
      padding-left: 24px;

      &.detail-text {
        color: #6366f1;
        font-style: italic;
        background: #eef2ff;
        padding: 8px 12px;
        border-radius: 6px;
        margin-left: 24px;
      }
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.85rem;
      color: white;
      font-weight: 500;
    }

    .no-tags {
      color: #94a3b8;
      font-style: italic;
    }

    .source-badge {
      display: flex;
      align-items: center;
      gap: 6px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #64748b;
      }
    }

    .meta-row {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 16px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      margin-top: 8px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: #94a3b8;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
    }
  `]
})
export class TransactionDetailDialogComponent {
  private dialogRef = inject(MatDialogRef<TransactionDetailDialogComponent>);
  data = inject<Transaction>(MAT_DIALOG_DATA);

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const day = parseInt(parts[2], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day} de ${months[monthIndex]} de ${year}`;
    }
    return dateStr;
  }

  edit() {
    this.dialogRef.close({ action: 'edit', transaction: this.data });
  }
}
