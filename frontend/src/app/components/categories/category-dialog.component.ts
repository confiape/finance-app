import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/models';

// 25 predefined colors palette
export const CATEGORY_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#78716c', // Stone
  '#64748b', // Slate
  '#71717a', // Zinc
  '#0d9488', // Teal darker
  '#059669', // Emerald darker
  '#2563eb', // Blue darker
  '#7c3aed', // Violet darker
  '#c026d3', // Fuchsia darker
];

@Component({
  selector: 'app-category-dialog',
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
    MatButtonToggleModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.parentId) {
        Nueva Subcategoría
      } @else if (data.category) {
        Editar {{ data.category.parent_id ? 'Subcategoría' : 'Categoría' }}
      } @else {
        Nueva Categoría
      }
    </h2>

    <mat-dialog-content>
      @if (data.parentCategory) {
        <div class="parent-info">
          <span class="parent-label">Subcategoría de:</span>
          <div class="parent-badge" [style.border-color]="data.parentCategory.color">
            <span class="parent-dot" [style.background-color]="data.parentCategory.color"></span>
            {{ data.parentCategory.name }}
          </div>
        </div>
      }

      @if (!data.category && !data.parentId) {
        <mat-button-toggle-group [(ngModel)]="form.type" class="type-toggle">
          <mat-button-toggle value="expense">Gasto</mat-button-toggle>
          <mat-button-toggle value="income">Ingreso</mat-button-toggle>
        </mat-button-toggle-group>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nombre</mat-label>
        <input matInput [(ngModel)]="form.name" required>
      </mat-form-field>

      <div class="color-section">
        <label>Color</label>
        <div class="color-grid">
          @for (color of colors; track color) {
            <button
              type="button"
              class="color-btn"
              [style.background-color]="color"
              [class.selected]="form.color === color"
              [class.disabled]="isColorUsed(color)"
              [disabled]="isColorUsed(color)"
              [matTooltip]="isColorUsed(color) ? 'Color en uso' : ''"
              (click)="form.color = color"
            >
              @if (form.color === color) {
                <mat-icon>check</mat-icon>
              }
              @if (isColorUsed(color)) {
                <mat-icon class="used-icon">block</mat-icon>
              }
            </button>
          }
        </div>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Icono</mat-label>
        <mat-select [(ngModel)]="form.icon">
          @for (icon of icons; track icon.value) {
            <mat-option [value]="icon.value">
              <mat-icon>{{ icon.value }}</mat-icon>
              {{ icon.label }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="preview">
        <div class="preview-icon" [style.background-color]="form.color">
          <mat-icon>{{ form.icon }}</mat-icon>
        </div>
        <span>{{ form.name || 'Vista previa' }}</span>
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

    .type-toggle {
      width: 100%;

      mat-button-toggle {
        flex: 1;
      }
    }

    .color-section {
      label {
        display: block;
        font-size: 0.875rem;
        color: #64748b;
        margin-bottom: 8px;
      }
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }

    .color-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
      position: relative;

      &:hover:not(.disabled) {
        transform: scale(1.1);
      }

      &.selected {
        border-color: #1e293b;
      }

      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;

        .used-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      mat-icon {
        color: white;
        font-size: 20px;
      }
    }

    .preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .preview-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        color: white;
        font-size: 24px;
      }
    }

    .parent-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .parent-label {
      font-size: 0.8rem;
      color: #64748b;
    }

    .parent-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: white;
      border: 2px solid;
      border-radius: 16px;
      font-weight: 500;
    }

    .parent-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  `]
})
export class CategoryDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<CategoryDialogComponent>);
  private apiService = inject(ApiService);
  data = inject<{ category?: Category; usedColors?: string[]; parentId?: number; parentCategory?: Category }>(MAT_DIALOG_DATA);

  form = {
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#6366f1',
    icon: 'category'
  };

  saving = signal(false);
  usedColors = signal<string[]>([]);

  colors = CATEGORY_COLORS;

  icons = [
    { value: 'restaurant', label: 'Alimentación' },
    { value: 'directions_car', label: 'Transporte' },
    { value: 'home', label: 'Hogar' },
    { value: 'shopping_cart', label: 'Compras' },
    { value: 'movie', label: 'Entretenimiento' },
    { value: 'medical_services', label: 'Salud' },
    { value: 'school', label: 'Educación' },
    { value: 'receipt', label: 'Servicios' },
    { value: 'payments', label: 'Salario' },
    { value: 'work', label: 'Trabajo' },
    { value: 'trending_up', label: 'Inversiones' },
    { value: 'savings', label: 'Ahorros' },
    { value: 'flight', label: 'Viajes' },
    { value: 'pets', label: 'Mascotas' },
    { value: 'sports_esports', label: 'Juegos' },
    { value: 'category', label: 'General' },
    // Icons for service subcategories
    { value: 'water_drop', label: 'Agua' },
    { value: 'bolt', label: 'Luz/Electricidad' },
    { value: 'wifi', label: 'Internet' },
    { value: 'local_fire_department', label: 'Gas' },
    { value: 'phone', label: 'Teléfono' },
    { value: 'tv', label: 'Cable/Streaming' },
    { value: 'security', label: 'Seguridad' },
    { value: 'cleaning_services', label: 'Limpieza' },
    { value: 'local_gas_station', label: 'Gasolina' },
    { value: 'fitness_center', label: 'Gimnasio' },
    { value: 'child_care', label: 'Cuidado niños' },
    { value: 'coffee', label: 'Café' },
    { value: 'fastfood', label: 'Comida rápida' },
    { value: 'local_grocery_store', label: 'Supermercado' }
  ];

  ngOnInit() {
    // Set used colors (excluding current category's color if editing)
    if (this.data.usedColors) {
      const currentColor = this.data.category?.color?.toLowerCase();
      this.usedColors.set(
        this.data.usedColors
          .map(c => c.toLowerCase())
          .filter(c => c !== currentColor)
      );
    }

    if (this.data.category) {
      this.form = {
        name: this.data.category.name,
        type: this.data.category.type,
        color: this.data.category.color,
        icon: this.data.category.icon
      };
    } else {
      // For new category/subcategory, pick first available color
      const firstAvailable = this.colors.find(c => !this.isColorUsed(c));
      if (firstAvailable) {
        this.form.color = firstAvailable;
      }

      // If creating subcategory, inherit type from parent
      if (this.data.parentCategory) {
        this.form.type = this.data.parentCategory.type;
      }
    }
  }

  isColorUsed(color: string): boolean {
    return this.usedColors().includes(color.toLowerCase());
  }

  save() {
    if (!this.form.name) return;

    this.saving.set(true);

    const categoryData: any = { ...this.form };

    // Add parent_id if creating a subcategory
    if (this.data.parentId) {
      categoryData.parent_id = this.data.parentId;
    }

    const request = this.data.category
      ? this.apiService.updateCategory(this.data.category.id, categoryData)
      : this.apiService.createCategory(categoryData);

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
