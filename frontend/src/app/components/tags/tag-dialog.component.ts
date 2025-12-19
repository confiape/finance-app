import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../services/api.service';
import { Tag } from '../../models/models';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b', '#78716c', '#0f172a'
];

@Component({
  selector: 'app-tag-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.tag ? 'Editar' : 'Nuevo' }} Tag</h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nombre</mat-label>
        <input matInput [(ngModel)]="form.name" required maxlength="50">
      </mat-form-field>

      <div class="color-section">
        <label>Color</label>
        <div class="color-grid">
          @for (color of colors; track color) {
            <button
              type="button"
              class="color-btn"
              [class.selected]="form.color === color"
              [style.background-color]="color"
              (click)="form.color = color"
            >
              @if (form.color === color) {
                <mat-icon>check</mat-icon>
              }
            </button>
          }
        </div>
      </div>

      <div class="preview">
        <span class="preview-label">Vista previa:</span>
        <span class="tag-preview" [style.background-color]="form.color">
          {{ form.name || 'Tag' }}
        </span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving() || !form.name">
        {{ saving() ? 'Guardando...' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 300px;
    }

    .full-width {
      width: 100%;
    }

    .color-section {
      label {
        display: block;
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 8px;
      }
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;
    }

    .color-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.1);
      }

      &.selected {
        border-color: #1e293b;
        transform: scale(1.15);
      }

      mat-icon {
        color: white;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .preview-label {
      font-size: 0.85rem;
      color: #64748b;
    }

    .tag-preview {
      padding: 4px 12px;
      border-radius: 14px;
      color: white;
      font-weight: 500;
      font-size: 0.9rem;
    }
  `]
})
export class TagDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<TagDialogComponent>);
  private apiService = inject(ApiService);
  data = inject<{ tag?: Tag }>(MAT_DIALOG_DATA);

  colors = TAG_COLORS;
  saving = signal(false);

  form = {
    name: '',
    color: TAG_COLORS[11] // default indigo
  };

  ngOnInit() {
    if (this.data.tag) {
      this.form = {
        name: this.data.tag.name,
        color: this.data.tag.color
      };
    }
  }

  save() {
    if (!this.form.name) return;

    this.saving.set(true);

    const payload = {
      name: this.form.name,
      color: this.form.color
    };

    const request = this.data.tag
      ? this.apiService.updateTag(this.data.tag.id, payload)
      : this.apiService.createTag(payload);

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
