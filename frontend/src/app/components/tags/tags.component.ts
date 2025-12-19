import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../services/api.service';
import { Tag } from '../../models/models';
import { TagDialogComponent } from './tag-dialog.component';

@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="container">
      <header class="page-header">
        <h1>Tags</h1>
        <button mat-raised-button color="primary" (click)="openDialog()">
          <mat-icon>add</mat-icon>
          Nuevo Tag
        </button>
      </header>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        @if (!tags().length) {
          <div class="empty-state">
            <mat-icon>sell</mat-icon>
            <h3>No tienes tags</h3>
            <p>Crea tags para organizar tus transacciones</p>
            <button mat-raised-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon>
              Crear primer tag
            </button>
          </div>
        } @else {
          <div class="tags-grid">
            @for (tag of tags(); track tag.id) {
              <mat-card class="tag-card">
                <div class="tag-color" [style.background-color]="tag.color"></div>
                <div class="tag-info">
                  <span class="tag-name">{{ tag.name }}</span>
                </div>
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openDialog(tag)">
                    <mat-icon>edit</mat-icon>
                    Editar
                  </button>
                  <button mat-menu-item (click)="deleteTag(tag)">
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

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: #64748b;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        color: #94a3b8;
      }

      h3 {
        margin: 0 0 8px 0;
        color: #1e293b;
      }

      p {
        margin-bottom: 24px;
      }
    }

    .tags-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .tag-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 12px 8px 12px 12px;
      gap: 12px;
    }

    .tag-color {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .tag-info {
      flex: 1;
      min-width: 0;
    }

    .tag-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class TagsComponent implements OnInit {
  private apiService = inject(ApiService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  tags = signal<Tag[]>([]);

  ngOnInit() {
    this.loadTags();
  }

  loadTags() {
    this.loading.set(true);
    this.apiService.getTags().subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openDialog(tag?: Tag) {
    const dialogRef = this.dialog.open(TagDialogComponent, {
      width: '400px',
      data: { tag }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTags();
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
}
