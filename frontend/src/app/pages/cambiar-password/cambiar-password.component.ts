import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';
import {
  REGLAS_PASSWORD,
  problemasDePassword,
} from '../../core/auth/auth.modelos';
import { mensajeDeError } from '../../core/http/errores';
import { camposIguales } from '../../core/validadores';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';

/**
 * Cambio de contraseña (RF07).
 *
 * Es obligatorio cuando el usuario entró con una contraseña temporal: en ese
 * caso la API solo permite esta pantalla (y cerrar sesión).
 */
@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AvisoComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.scss',
})
export class CambiarPasswordComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly reglas = REGLAS_PASSWORD;
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly hecho = signal(false);
  readonly esObligatorio = computed(() => this.auth.debeCambiarPassword());

  readonly formulario = inject(FormBuilder).nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, Validators.minLength(10)]],
      repetir: ['', [Validators.required]],
    },
    { validators: [camposIguales('passwordNueva', 'repetir')] },
  );

  async cambiar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    try {
      const { passwordActual, passwordNueva } = this.formulario.getRawValue();
      const problemas = problemasDePassword(passwordNueva);
      if (problemas.length > 0) {
        this.error.set(
          `La contraseña nueva debe cumplir: ${problemas.join(', ')}.`,
        );
        return;
      }

      await this.auth.cambiarPassword(passwordActual, passwordNueva);
      this.hecho.set(true);
      await this.router.navigate(['/panel']);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }
}
