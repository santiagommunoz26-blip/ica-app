import { Component, computed, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISOS, type Permiso } from '../../core/auth/auth.modelos';
import { mensajeDeError } from '../../core/http/errores';

/** Opción del menú lateral. */
interface OpcionNavegacion {
  etiqueta: string;
  icono: string;
  ruta: string;
  /** Permiso necesario para verla (RF04); si falta, la ve cualquier rol. */
  permiso?: Permiso;
  /** Falso mientras el módulo que la implementa no esté construido. */
  disponible: boolean;
  modulo?: string;
}

/**
 * Armazón de la aplicación (RF04): barra superior, menú lateral limitado por
 * rol y área de contenido. Incluye el cierre de sesión y el aviso de trabajo
 * sin conexión (RF03).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal<string | null>(null);

  private readonly navegacion: OpcionNavegacion[] = [
    { etiqueta: 'Panel', icono: 'dashboard', ruta: '/panel', disponible: true },
    {
      etiqueta: 'Visitas',
      icono: 'event_note',
      ruta: '/visitas',
      permiso: PERMISOS.VISITAS_CREAR,
      disponible: false,
      modulo: 'M2',
    },
    {
      etiqueta: 'Inspección',
      icono: 'fact_check',
      ruta: '/inspeccion',
      permiso: PERMISOS.INSPECCION_REGISTRAR,
      disponible: false,
      modulo: 'M3',
    },
    {
      etiqueta: 'Resultados',
      icono: 'calculate',
      ruta: '/resultados',
      permiso: PERMISOS.HISTORIAL_CONSULTAR,
      disponible: false,
      modulo: 'M5',
    },
    {
      etiqueta: 'Reportes',
      icono: 'description',
      ruta: '/reportes',
      permiso: PERMISOS.REPORTES_CONSULTAR,
      disponible: false,
      modulo: 'M6',
    },
    {
      etiqueta: 'Administración',
      icono: 'admin_panel_settings',
      ruta: '/administracion/usuarios',
      permiso: PERMISOS.USUARIOS_GESTIONAR,
      disponible: true,
    },
  ];

  /** Opciones que este rol puede ver y que ya existen (RF04). */
  readonly opciones = computed(() =>
    this.navegacion.filter(
      (opcion) =>
        opcion.disponible &&
        (!opcion.permiso || this.auth.puede(opcion.permiso)),
    ),
  );

  /** Opciones todavía no construidas, para mostrarlas informativamente. */
  readonly proximas = computed(() =>
    this.navegacion.filter(
      (opcion) =>
        !opcion.disponible &&
        (!opcion.permiso || this.auth.puede(opcion.permiso)),
    ),
  );

  readonly iniciales = computed(() => {
    const nombre = this.auth.usuario()?.nombreCompleto ?? '';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  });

  async cerrarSesion(): Promise<void> {
    await this.auth.cerrarSesion();
  }

  irACambiarPassword(): void {
    void this.router.navigate(['/cambiar-password']);
  }

  /** Intenta recuperar la conexión cuando se entró sin red con el PIN (RF03). */
  async reconectar(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.restaurarSesion();
      if (!this.auth.sinConexion()) {
        await this.auth.cargarPerfil();
      }
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    }
  }
}
