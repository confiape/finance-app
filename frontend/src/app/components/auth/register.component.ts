import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon color="primary">account_balance_wallet</mat-icon>
            FinanceApp
          </mat-card-title>
          <mat-card-subtitle>Crea tu cuenta</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <form (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre completo</mat-label>
              <input matInput type="text" [(ngModel)]="name" name="name" required>
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Correo electrónico</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required>
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contraseña</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'" [(ngModel)]="password" name="password" required>
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>Mínimo 6 caracteres</mat-hint>
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Crear cuenta
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions align="end">
          <span>¿Ya tienes cuenta?</span>
          <a mat-button color="primary" routerLink="/login">Inicia sesión</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    }

    .auth-card {
      width: 100%;
      max-width: 400px;
      padding: 24px;

      mat-card-header {
        margin-bottom: 24px;

        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.5rem;
        }
      }

      mat-form-field {
        margin-bottom: 8px;
      }

      button[type="submit"] {
        height: 48px;
        font-size: 1rem;
        margin-top: 8px;
      }

      mat-card-actions {
        margin-top: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
    }

    .error-message {
      background: #fef2f2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.875rem;
    }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  hidePassword = signal(true);

  onSubmit() {
    if (!this.name || !this.email || !this.password) {
      this.error.set('Por favor completa todos los campos');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.register(this.name, this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Error al crear la cuenta');
      }
    });
  }
}
