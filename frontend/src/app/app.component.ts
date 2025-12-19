import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule
  ],
  template: `
    @if (authService.isAuthenticated()) {
      <mat-toolbar color="primary" class="toolbar">
        <span class="logo">FinanceApp</span>
        <span class="spacer"></span>
        <nav class="desktop-nav">
          <a mat-button routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon> Dashboard
          </a>
          <a mat-button routerLink="/transactions" routerLinkActive="active">
            <mat-icon>receipt_long</mat-icon> Transacciones
          </a>
          <a mat-button routerLink="/accounts" routerLinkActive="active">
            <mat-icon>account_balance_wallet</mat-icon> Cuentas
          </a>
          <a mat-button routerLink="/import" routerLinkActive="active">
            <mat-icon>upload_file</mat-icon> Importar
          </a>
          <a mat-button routerLink="/tags" routerLinkActive="active">
            <mat-icon>sell</mat-icon> Tags
          </a>
        </nav>
        <button mat-icon-button [matMenuTriggerFor]="menu">
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <div class="menu-header">
            <strong>{{ authService.user()?.name }}</strong>
            <small>{{ authService.user()?.email }}</small>
          </div>
          <button mat-menu-item (click)="authService.logout()">
            <mat-icon>logout</mat-icon>
            Cerrar sesión
          </button>
        </mat-menu>
      </mat-toolbar>

      <!-- Mobile Navigation -->
      <nav class="mobile-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <mat-icon>dashboard</mat-icon>
          <span>Inicio</span>
        </a>
        <a routerLink="/transactions" routerLinkActive="active" class="nav-item">
          <mat-icon>receipt_long</mat-icon>
          <span>Movim.</span>
        </a>
        <a routerLink="/accounts" routerLinkActive="active" class="nav-item">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>Cuentas</span>
        </a>
        <a routerLink="/import" routerLinkActive="active" class="nav-item">
          <mat-icon>upload_file</mat-icon>
          <span>Importar</span>
        </a>
        <a routerLink="/tags" routerLinkActive="active" class="nav-item">
          <mat-icon>sell</mat-icon>
          <span>Tags</span>
        </a>
      </nav>
    }

    <main [class.main-content]="authService.isAuthenticated()">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .logo {
      font-weight: 600;
      font-size: 1.25rem;
    }

    .spacer {
      flex: 1;
    }

    .desktop-nav {
      display: none;
      gap: 8px;

      @media (min-width: 768px) {
        display: flex;
      }

      a {
        color: rgba(255, 255, 255, 0.9);

        &.active {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        mat-icon {
          margin-right: 4px;
        }
      }
    }

    .menu-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;

      small {
        color: #64748b;
      }
    }
  `]
})
export class AppComponent {
  authService = inject(AuthService);
}
