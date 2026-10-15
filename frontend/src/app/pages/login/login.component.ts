import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/errores';

/**
 * Inicio de sesión (RF01) con las tres entradas del wireframe:
 * correo y contraseña, recuperación de contraseña (RF06) y acceso sin
 * conexión con PIN (RF03).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly verPassword = signal(false);
  readonly recuperacionAbierta = signal(false);
  readonly recuperacionEnviada = signal(false);
  readonly pinAbierto = signal(false);

  readonly formulario = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    recordarme: [false],
  });

  readonly formularioRecuperacion = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  readonly formularioPin = inject(FormBuilder).nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  /** ¿Este equipo tiene un PIN configurado? (RF03) */
  readonly hayPin = this.auth.hayPinEnEquipo();

  async ingresar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    try {
      const { correo, password, recordarme } = this.formulario.getRawValue();
      const usuario = await this.auth.iniciarSesion({
        correo,
        password,
        recordarme,
      });
      await this.router.navigate([
        usuario.debeCambiarPassword ? '/cambiar-password' : this.destino(),
      ]);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  async enviarRecuperacion(): Promise<void> {
    if (this.formularioRecuperacion.invalid) {
      this.formularioRecuperacion.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await new Promise<void>((resolver, rechazar) => {
        this.auth
          .solicitarRecuperacion(
            this.formularioRecuperacion.getRawValue().correo,
          )
          .subscribe({ next: () => resolver(), error: (e) => rechazar(e) });
      });
      this.recuperacionEnviada.set(true);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  async entrarConPin(): Promise<void> {
    if (this.formularioPin.invalid) {
      this.formularioPin.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.entrarConPin(this.formularioPin.getRawValue().pin);
      await this.router.navigate(['/panel']);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Destino al que se dirigía el usuario antes de pedirle la sesión. */
  private destino(): string {
    const destino = this.ruta.snapshot.queryParamMap.get('destino');
    return destino && destino.startsWith('/') ? destino : '/panel';
  }
}
