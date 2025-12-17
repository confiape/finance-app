import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/models';
import { CategoryDialogComponent } from './category-dialog.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatMenuModule
  ],
  template: `
    <div class="container">
      <header class="page-header">
        <h1>Categorías</h1>
        <button mat-raised-button color="primary" (click)="openDialog()">
          <mat-icon>add</mat-icon>
          Nueva
        </button>
      </header>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        <mat-tab-group>
          <mat-tab label="Gastos">
            <div class="category-list">
              @for (cat of expenseCategories(); track cat.id) {
                <mat-card class="category-card-row">
                  <div class="category-main" (click)="toggleExpand(cat.id)">
                    <div class="category-icon" [style.background-color]="cat.color">
                      <mat-icon>{{ cat.icon }}</mat-icon>
                    </div>
                    <div class="category-info">
                      <span class="category-name">{{ cat.name }}</span>
                      @if (cat.subcategories?.length) {
                        <span class="subcategory-count">{{ cat.subcategories!.length }} subcategorías</span>
                      }
                    </div>
                    @if (cat.subcategories?.length) {
                      <mat-icon class="expand-icon" [class.expanded]="isExpanded(cat.id)">expand_more</mat-icon>
                    }
                  </div>
                  <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="openDialog(cat)">
                      <mat-icon>edit</mat-icon>
                      Editar
                    </button>
                    <button mat-menu-item (click)="openDialog(undefined, cat.id)">
                      <mat-icon>add</mat-icon>
                      Agregar subcategoría
                    </button>
                    <button mat-menu-item (click)="deleteCategory(cat)">
                      <mat-icon>delete</mat-icon>
                      Eliminar
                    </button>
                  </mat-menu>
                </mat-card>

                <!-- Subcategories -->
                @if (cat.subcategories?.length && isExpanded(cat.id)) {
                  <div class="subcategories">
                    @for (sub of cat.subcategories; track sub.id) {
                      <mat-card class="subcategory-card">
                        <div class="subcategory-icon" [style.background-color]="sub.color">
                          <mat-icon>{{ sub.icon }}</mat-icon>
                        </div>
                        <span class="subcategory-name">{{ sub.name }}</span>
                        <button mat-icon-button [matMenuTriggerFor]="subMenu" (click)="$event.stopPropagation()">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #subMenu="matMenu">
                          <button mat-menu-item (click)="openDialog(sub)">
                            <mat-icon>edit</mat-icon>
                            Editar
                          </button>
                          <button mat-menu-item (click)="deleteCategory(sub)">
                            <mat-icon>delete</mat-icon>
                            Eliminar
                          </button>
                        </mat-menu>
                      </mat-card>
                    }
                  </div>
                }
              }
            </div>
          </mat-tab>

          <mat-tab label="Ingresos">
            <div class="category-list">
              @for (cat of incomeCategories(); track cat.id) {
                <mat-card class="category-card-row">
                  <div class="category-main" (click)="toggleExpand(cat.id)">
                    <div class="category-icon" [style.background-color]="cat.color">
                      <mat-icon>{{ cat.icon }}</mat-icon>
                    </div>
                    <div class="category-info">
                      <span class="category-name">{{ cat.name }}</span>
                      @if (cat.subcategories?.length) {
                        <span class="subcategory-count">{{ cat.subcategories!.length }} subcategorías</span>
                      }
                    </div>
                    @if (cat.subcategories?.length) {
                      <mat-icon class="expand-icon" [class.expanded]="isExpanded(cat.id)">expand_more</mat-icon>
                    }
                  </div>
                  <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="openDialog(cat)">
                      <mat-icon>edit</mat-icon>
                      Editar
                    </button>
                    <button mat-menu-item (click)="openDialog(undefined, cat.id)">
                      <mat-icon>add</mat-icon>
                      Agregar subcategoría
                    </button>
                    <button mat-menu-item (click)="deleteCategory(cat)">
                      <mat-icon>delete</mat-icon>
                      Eliminar
                    </button>
                  </mat-menu>
                </mat-card>

                <!-- Subcategories -->
                @if (cat.subcategories?.length && isExpanded(cat.id)) {
                  <div class="subcategories">
                    @for (sub of cat.subcategories; track sub.id) {
                      <mat-card class="subcategory-card">
                        <div class="subcategory-icon" [style.background-color]="sub.color">
                          <mat-icon>{{ sub.icon }}</mat-icon>
                        </div>
                        <span class="subcategory-name">{{ sub.name }}</span>
                        <button mat-icon-button [matMenuTriggerFor]="subMenu" (click)="$event.stopPropagation()">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #subMenu="matMenu">
                          <button mat-menu-item (click)="openDialog(sub)">
                            <mat-icon>edit</mat-icon>
                            Editar
                          </button>
                          <button mat-menu-item (click)="deleteCategory(sub)">
                            <mat-icon>delete</mat-icon>
                            Eliminar
                          </button>
                        </mat-menu>
                      </mat-card>
                    }
                  </div>
                }
              }
            </div>
          </mat-tab>
        </mat-tab-group>
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

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 16px;
    }

    .category-card-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
    }

    .category-main {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      cursor: pointer;
    }

    .category-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: white;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .category-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .category-name {
      font-weight: 500;
    }

    .subcategory-count {
      font-size: 0.75rem;
      color: #64748b;
    }

    .expand-icon {
      color: #64748b;
      transition: transform 0.2s;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    .subcategories {
      margin-left: 32px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-bottom: 8px;
    }

    .subcategory-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 8px 12px;
      gap: 10px;
      background: #f8fafc;
      border-left: 3px solid #e2e8f0;
    }

    .subcategory-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: white;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .subcategory-name {
      font-weight: 500;
      font-size: 0.9rem;
      flex: 1;
    }
  `]
})
export class CategoriesComponent implements OnInit {
  private apiService = inject(ApiService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  categories = signal<Category[]>([]);
  expandedIds = signal<Set<number>>(new Set());

  expenseCategories = signal<Category[]>([]);
  incomeCategories = signal<Category[]>([]);

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading.set(true);
    this.apiService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        // Filter only root categories (parent_id is null)
        this.expenseCategories.set(categories.filter(c => c.type === 'expense' && !c.parent_id));
        this.incomeCategories.set(categories.filter(c => c.type === 'income' && !c.parent_id));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleExpand(id: number) {
    const current = this.expandedIds();
    const newSet = new Set(current);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.expandedIds.set(newSet);
  }

  isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  getAllUsedColors(): string[] {
    const colors: string[] = [];
    const addColors = (cats: Category[]) => {
      for (const cat of cats) {
        colors.push(cat.color);
        if (cat.subcategories) {
          addColors(cat.subcategories);
        }
      }
    };
    addColors(this.categories());
    return colors;
  }

  openDialog(category?: Category, parentId?: number) {
    // Get all used colors from existing categories (including subcategories)
    const usedColors = this.getAllUsedColors();

    // Find parent category if parentId is provided
    let parentCategory: Category | undefined;
    if (parentId) {
      parentCategory = this.categories().find(c => c.id === parentId);
    }

    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '400px',
      data: { category, usedColors, parentId, parentCategory }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCategories();
      }
    });
  }

  deleteCategory(cat: Category) {
    const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
    const message = hasSubcats
      ? `¿Eliminar la categoría "${cat.name}" y sus ${cat.subcategories!.length} subcategorías?`
      : `¿Eliminar la categoría "${cat.name}"?`;

    if (confirm(message)) {
      this.apiService.deleteCategory(cat.id).subscribe({
        next: () => this.loadCategories()
      });
    }
  }
}
