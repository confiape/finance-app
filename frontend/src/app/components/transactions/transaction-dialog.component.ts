import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import { Transaction, Tag } from '../../models/models';

@Component({
  selector: 'app-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonToggleModule,
    MatChipsModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.transaction ? 'Editar' : 'Nueva' }} Transacción</h2>

    <mat-dialog-content>
      <mat-button-toggle-group [(ngModel)]="form.type" class="type-toggle">
        <mat-button-toggle value="expense">
          <mat-icon>trending_down</mat-icon>
          Gasto
        </mat-button-toggle>
        <mat-button-toggle value="income">
          <mat-icon>trending_up</mat-icon>
          Ingreso
        </mat-button-toggle>
      </mat-button-toggle-group>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Descripción</mat-label>
        <input matInput [(ngModel)]="form.description" required>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Detalle (opcional)</mat-label>
        <input matInput [(ngModel)]="form.detail" placeholder="Nota o detalle adicional">
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Monto</mat-label>
        <span matPrefix>$ </span>
        <input matInput type="number" [(ngModel)]="form.amount" required min="0">
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Tags</mat-label>
        <mat-select [(ngModel)]="form.tag_ids" multiple>
          @for (tag of data.tags; track tag.id) {
            <mat-option [value]="tag.id">
              <span class="tag-option">
                <span class="tag-color" [style.background-color]="tag.color"></span>
                {{ tag.name }}
              </span>
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Selected tags preview -->
      @if (form.tag_ids.length > 0) {
        <div class="selected-tags">
          @for (tagId of form.tag_ids; track tagId) {
            <span class="tag-badge" [style.background-color]="getTagColor(tagId)">
              {{ getTagName(tagId) }}
            </span>
          }
        </div>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Fecha</mat-label>
        <input matInput [matDatepicker]="picker" [(ngModel)]="form.date">
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Guardando...' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 300px;
    }

    .type-toggle {
      width: 100%;
      margin-bottom: 8px;

      mat-button-toggle {
        flex: 1;
      }
    }

    .tag-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tag-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }

    .tag-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 14px;
      font-size: 0.8rem;
      color: white;
      font-weight: 500;
    }
  `]
})
export class TransactionDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<TransactionDialogComponent>);
  private apiService = inject(ApiService);
  data = inject<{ transaction?: Transaction; tags: Tag[] }>(MAT_DIALOG_DATA);

  form = {
    description: '',
    detail: '',
    amount: 0,
    type: 'expense' as 'income' | 'expense',
    tag_ids: [] as number[],
    date: new Date()
  };

  saving = signal(false);

  ngOnInit() {
    if (this.data.transaction) {
      const tx = this.data.transaction;
      this.form = {
        description: tx.description,
        detail: tx.detail || '',
        amount: tx.amount,
        type: tx.type,
        tag_ids: tx.tags?.map(t => t.id) || [],
        date: new Date(tx.date)
      };
    }
  }

  getTagName(tagId: number): string {
    return this.data.tags.find(t => t.id === tagId)?.name || '';
  }

  getTagColor(tagId: number): string {
    return this.data.tags.find(t => t.id === tagId)?.color || '#64748b';
  }

  save() {
    if (!this.form.description || !this.form.amount) return;

    this.saving.set(true);

    const payload: Partial<Transaction> & { tag_ids?: number[] } = {
      description: this.form.description,
      detail: this.form.detail || undefined,
      amount: this.form.amount,
      type: this.form.type,
      tag_ids: this.form.tag_ids,
      date: this.form.date.toISOString().split('T')[0]
    };

    const request = this.data.transaction
      ? this.apiService.updateTransaction(this.data.transaction.id, payload)
      : this.apiService.createTransaction(payload);

    request.subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }
}
