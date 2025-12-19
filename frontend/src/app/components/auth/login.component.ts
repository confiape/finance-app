import { Component, inject, signal, AfterViewInit, NgZone } from '@angular/core';
import { environment } from '../../../environments/environment';

declare const google: any;
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
  selector: 'app-login',
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
          <mat-card-subtitle>Inicia sesión en tu cuenta</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <form (ngSubmit)="onSubmit()">
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
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Iniciar sesión
              }
            </button>
          </form>

          <div class="divider">
            <span>o</span>
          </div>

          <div id="google-signin-button" class="google-btn-container"></div>
        </mat-card-content>

        <mat-card-actions align="end">
          <span>¿No tienes cuenta?</span>
          <a mat-button color="primary" routerLink="/register">Regístrate</a>
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

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;

      &::before, &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }

      span {
        padding: 0 16px;
        color: #64748b;
        font-size: 0.875rem;
      }
    }

    .google-btn-container {
      display: flex;
      justify-content: center;
    }
  `]
})
export class LoginComponent implements AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  hidePassword = signal(true);

  ngAfterViewInit() {
    this.initializeGoogleSignIn();
  }

  private initializeGoogleSignIn() {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleGoogleCallback(response)
      });

      google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          locale: 'es'
        }
      );
    }
  }

  private handleGoogleCallback(response: any) {
    this.ngZone.run(() => {
      this.loading.set(true);
      this.error.set('');

      this.authService.googleLogin(response.credential).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.error || 'Error al iniciar sesión con Google');
        }
      });
    });
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.error.set('Por favor completa todos los campos');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Error al iniciar sesión');
      }
    });
  }
}
