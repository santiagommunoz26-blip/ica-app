import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
 * Restablecimiento de contraseña (RF06): el usuario llega desde el enlace del
 * correo, que trae el token de un solo uso en la dirección.
 */
@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AvisoComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './restablecer-password.component.html',
  styleUrl: './restablecer-password.component.scss',
})
export class RestablecerPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly reglas = REGLAS_PASSWORD;
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly hecho = signal(false);
  readonly token = this.ruta.snapshot.queryParamMap.get('token');

  readonly formulario = inject(FormBuilder).nonNullable.group(
    {
      passwordNueva: ['', [Validators.required, Validators.minLength(10)]],
      repetir: ['', [Validators.required]],
    },
    { validators: [camposIguales('passwordNueva', 'repetir')] },
  );

  async restablecer(): Promise<void> {
    if (!this.token) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    try {
      const passwordNueva = this.formulario.getRawValue().passwordNueva;
      const problemas = problemasDePassword(passwordNueva);
      if (problemas.length > 0) {
        this.error.set(`La contraseña debe cumplir: ${problemas.join(', ')}.`);
        return;
      }

      await this.auth.restablecerPassword(this.token, passwordNueva);
      this.hecho.set(true);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  irAlIngreso(): void {
    void this.router.navigate(['/login']);
  }
}
