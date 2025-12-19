import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Tag, ParsedTransaction } from '../../models/models';

export interface SplitPart {
  amount: number;
  tag_ids: number[];
  details: string;
}

export interface SplitDialogData {
  transaction: ParsedTransaction & { tag_ids?: number[] };
  tags: Tag[];
}

export interface SplitDialogResult {
  parts: SplitPart[];
}

@Component({
  selector: 'app-split-transaction-dialog',
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
    CurrencyPipe
  ],
  template: `
    <h2 mat-dialog-title>Dividir Gasto</h2>

    <mat-dialog-content>
      <div class="original-transaction">
        <div class="original-info">
          <span class="original-description">{{ data.transaction.description }}</span>
          <span class="original-amount">{{ data.transaction.amount | currency:'S/':'symbol':'1.2-2' }}</span>
        </div>
        <span class="original-date">{{ data.transaction.date }}</span>
      </div>

      <div class="split-summary" [class.valid]="isBalanced()" [class.invalid]="!isBalanced()">
        <div class="summary-row">
          <span>Total original:</span>
          <span>{{ data.transaction.amount | currency:'S/':'symbol':'1.2-2' }}</span>
        </div>
        <div class="summary-row">
          <span>Suma de partes:</span>
          <span>{{ totalSplit() | currency:'S/':'symbol':'1.2-2' }}</span>
        </div>
        <div class="summary-row difference">
          <span>Diferencia:</span>
          <span [class.negative]="difference() < 0" [class.positive]="difference() > 0">
            {{ difference() | currency:'S/':'symbol':'1.2-2' }}
          </span>
        </div>
      </div>

      <div class="parts-list">
        @for (part of parts(); track part; let i = $index) {
          <div class="part-item">
            <div class="part-header">
              <span class="part-number">Parte {{ i + 1 }}</span>
              @if (parts().length > 2) {
                <button mat-icon-button color="warn" (click)="removePart(i)" class="remove-btn">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>

            <div class="part-fields">
              <mat-form-field appearance="outline" class="amount-field">
                <mat-label>Monto</mat-label>
                <span matPrefix>S/ </span>
                <input matInput type="number" [(ngModel)]="part.amount" min="0" step="0.01" (ngModelChange)="updateParts()">
              </mat-form-field>

              <mat-form-field appearance="outline" class="tags-field">
                <mat-label>Tags</mat-label>
                <mat-select [(ngModel)]="part.tag_ids" multiple>
                  @for (tag of data.tags; track tag.id) {
                    <mat-option [value]="tag.id">
                      <span class="tag-option">
                        <span class="tag-dot" [style.background-color]="tag.color"></span>
                        {{ tag.name }}
                      </span>
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="details-field">
              <mat-label>Detalles</mat-label>
              <input matInput [(ngModel)]="part.details" placeholder="Descripción adicional (opcional)">
            </mat-form-field>
          </div>
        }
      </div>

      <button mat-stroked-button class="add-part-btn" (click)="addPart()">
        <mat-icon>add</mat-icon>
        Agregar otra parte
      </button>

      <div class="quick-split">
        <span class="quick-split-label">División rápida:</span>
        <button mat-button (click)="splitEvenly(2)">2 partes</button>
        <button mat-button (click)="splitEvenly(3)">3 partes</button>
        <button mat-button (click)="distributeRemaining()">Distribuir resto</button>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-raised-button
        color="primary"
        (click)="confirm()"
        [disabled]="!isBalanced() || !allPartsValid()"
      >
        Dividir gasto
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 400px;
      max-width: 500px;
    }

    .original-transaction {
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #ef4444;
    }

    .original-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .original-description {
      font-weight: 500;
      flex: 1;
      margin-right: 16px;
    }

    .original-amount {
      font-weight: 600;
      font-size: 1.1rem;
      color: #ef4444;
    }

    .original-date {
      font-size: 0.8rem;
      color: #64748b;
    }

    .split-summary {
      padding: 12px 16px;
      border-radius: 8px;
      background: #f1f5f9;
      border: 2px solid #e2e8f0;

      &.valid {
        background: #f0fdf4;
        border-color: #22c55e;
      }

      &.invalid {
        background: #fef2f2;
        border-color: #ef4444;
      }
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      padding: 2px 0;

      &.difference {
        font-weight: 600;
        border-top: 1px solid #e2e8f0;
        margin-top: 4px;
        padding-top: 6px;
      }
    }

    .negative {
      color: #ef4444;
    }

    .positive {
      color: #f59e0b;
    }

    .parts-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 300px;
      overflow-y: auto;
    }

    .part-item {
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .part-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .part-number {
      font-weight: 600;
      color: #475569;
    }

    .remove-btn {
      width: 28px;
      height: 28px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .part-fields {
      display: flex;
      gap: 12px;
    }

    .amount-field {
      width: 140px;
    }

    .tags-field {
      flex: 1;
    }

    .details-field {
      width: 100%;
    }

    ::ng-deep .amount-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .tags-field .mat-mdc-form-field-subscript-wrapper,
    ::ng-deep .details-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .tag-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tag-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .add-part-btn {
      width: 100%;
    }

    .quick-split {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 0;
      border-top: 1px solid #e2e8f0;
    }

    .quick-split-label {
      font-size: 0.85rem;
      color: #64748b;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class SplitTransactionDialogComponent {
  private dialogRef = inject(MatDialogRef<SplitTransactionDialogComponent>);
  data = inject<SplitDialogData>(MAT_DIALOG_DATA);

  parts = signal<SplitPart[]>([
    { amount: 0, tag_ids: [], details: '' },
    { amount: 0, tag_ids: [], details: '' }
  ]);

  totalSplit = computed(() => {
    return this.parts().reduce((sum, part) => sum + (part.amount || 0), 0);
  });

  difference = computed(() => {
    return Math.round((this.data.transaction.amount - this.totalSplit()) * 100) / 100;
  });

  ngOnInit() {
    // Initialize with two parts, first one with the original tags
    const originalTagIds = this.data.transaction.tag_ids || [];
    this.parts.set([
      { amount: this.data.transaction.amount, tag_ids: [...originalTagIds], details: '' },
      { amount: 0, tag_ids: [], details: '' }
    ]);
  }

  isBalanced(): boolean {
    return Math.abs(this.difference()) < 0.01;
  }

  allPartsValid(): boolean {
    return this.parts().every(part => part.amount > 0);
  }

  addPart() {
    this.parts.update(parts => [...parts, { amount: 0, tag_ids: [], details: '' }]);
  }

  removePart(index: number) {
    if (this.parts().length > 2) {
      this.parts.update(parts => parts.filter((_, i) => i !== index));
    }
  }

  updateParts() {
    // Trigger reactivity
    this.parts.update(parts => [...parts]);
  }

  splitEvenly(count: number) {
    const amount = this.data.transaction.amount;
    const perPart = Math.floor((amount / count) * 100) / 100;
    const remainder = Math.round((amount - perPart * count) * 100) / 100;

    const originalTagIds = this.data.transaction.tag_ids || [];
    const newParts: SplitPart[] = [];
    for (let i = 0; i < count; i++) {
      newParts.push({
        amount: i === 0 ? perPart + remainder : perPart,
        tag_ids: i === 0 ? [...originalTagIds] : [],
        details: ''
      });
    }
    this.parts.set(newParts);
  }

  distributeRemaining() {
    const diff = this.difference();
    if (diff === 0) return;

    // Find the last part with amount 0 or add the difference to the first part
    const parts = [...this.parts()];
    const emptyPartIndex = parts.findIndex(p => p.amount === 0);

    if (emptyPartIndex !== -1) {
      parts[emptyPartIndex].amount = diff;
    } else {
      parts[0].amount = Math.round((parts[0].amount + diff) * 100) / 100;
    }

    this.parts.set(parts);
  }

  confirm() {
    if (this.isBalanced() && this.allPartsValid()) {
      this.dialogRef.close({ parts: this.parts() } as SplitDialogResult);
    }
  }
}
