import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';
import { ETIQUETA_PERMISO } from '../../core/auth/auth.modelos';
import { mensajeDeError } from '../../core/http/errores';
import { camposIguales } from '../../core/validadores';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';

/**
 * Pantalla inicial tras ingresar (M1).
 *
 * Los módulos de trabajo (visitas, inspección, resultados y reportes) llegan
 * en los módulos M2 a M8; aquí se muestra el estado de la sesión, los permisos
 * del rol (RF04) y la configuración del PIN sin conexión (RF03).
 */
@Component({
  selector: 'app-panel',
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
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent {
  readonly auth = inject(AuthService);

  readonly etiquetas = ETIQUETA_PERMISO;
  readonly tienePin = computed(() => this.auth.usuario()?.tienePin ?? false);
  readonly guardandoPin = signal(false);
  readonly mensajePin = signal<string | null>(null);
  readonly errorPin = signal<string | null>(null);

  readonly formularioPin = inject(FormBuilder).nonNullable.group(
    {
      pin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      repetir: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      passwordActual: ['', [Validators.required]],
    },
    { validators: [camposIguales('pin', 'repetir')] },
  );

  async configurarPin(): Promise<void> {
    if (this.formularioPin.invalid) {
      this.formularioPin.markAllAsTouched();
      return;
    }

    this.guardandoPin.set(true);
    this.mensajePin.set(null);
    this.errorPin.set(null);
    try {
      const { pin, passwordActual } = this.formularioPin.getRawValue();
      await this.auth.configurarPin(pin, passwordActual);
      this.formularioPin.reset();
      this.mensajePin.set(
        'PIN configurado. Ya puede entrar sin conexión desde este equipo.',
      );
    } catch (fallo) {
      this.errorPin.set(mensajeDeError(fallo));
    } finally {
      this.guardandoPin.set(false);
    }
  }

  readonly moduloActual = 'M1 · Autenticación y usuarios';
  readonly proximoModulo = 'M2 · Gestión de visitas';
}
