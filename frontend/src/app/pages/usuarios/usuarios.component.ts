import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, type Observable } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { UsuariosService } from '../../core/usuarios/usuarios.service';
import type {
  EstadoUsuario,
  Rol,
  RolCatalogo,
  Usuario,
} from '../../core/auth/auth.modelos';
import { mensajeDeError } from '../../core/http/errores';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';
import { EstadoVacioComponent } from '../../shared/ui/estado-vacio/estado-vacio.component';
import { InsigniaComponent } from '../../shared/ui/insignia/insignia.component';

/**
 * Administración de usuarios y roles (RF05, RF04).
 *
 * Sigue el wireframe: lista con búsqueda, estado y último acceso; panel
 * lateral para crear o editar; y los permisos del rol elegido, que se muestran
 * (no se editan: cada usuario tiene un solo rol y sus permisos son los del
 * rol).
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    AvisoComponent,
    EstadoVacioComponent,
    InsigniaComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly servicio = inject(UsuariosService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly usuarios = signal<Usuario[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly porPagina = 10;
  readonly busqueda = signal('');
  readonly catalogo = signal<RolCatalogo[]>([]);

  readonly panelAbierto = signal(false);
  readonly enEdicion = signal<Usuario | null>(null);
  /** Contraseña temporal recién generada, que se muestra una sola vez. */
  readonly credenciales = signal<{ correo: string; password: string } | null>(
    null,
  );

  readonly formulario = inject(FormBuilder).nonNullable.group({
    nombreCompleto: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    ],
    correo: ['', [Validators.required, Validators.email]],
    rol: ['INSPECTOR' as Rol, [Validators.required]],
    passwordTemporal: [''],
  });

  /** Permisos del rol seleccionado en el formulario (RF04). */
  readonly permisosDelRol = computed(() => {
    const rol = this.formulario.controls.rol.value;
    return (
      this.catalogo().find((entrada) => entrada.rol === rol)?.permisos ?? []
    );
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.porPagina)),
  );

  readonly esEdicion = computed(() => this.enEdicion() !== null);

  ngOnInit(): void {
    void this.cargar();
    this.servicio.catalogoRoles().subscribe({
      next: (catalogo) => this.catalogo.set(catalogo),
      error: (fallo) => this.error.set(mensajeDeError(fallo)),
    });
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const respuesta = await firstValueFrom(
        this.servicio.listar({
          pagina: this.pagina(),
          porPagina: this.porPagina,
          ...(this.busqueda() ? { busqueda: this.busqueda() } : {}),
        }),
      );
      this.usuarios.set(respuesta.datos);
      this.total.set(respuesta.total);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(1);
    void this.cargar();
  }

  cambiarPagina(delta: number): void {
    const nueva = this.pagina() + delta;
    if (nueva < 1 || nueva > this.totalPaginas()) return;
    this.pagina.set(nueva);
    void this.cargar();
  }

  abrirNuevo(): void {
    this.enEdicion.set(null);
    this.error.set(null);
    this.formulario.reset({
      rol: 'INSPECTOR',
      nombreCompleto: '',
      correo: '',
      passwordTemporal: '',
    });
    this.panelAbierto.set(true);
  }

  abrirEdicion(usuario: Usuario): void {
    this.enEdicion.set(usuario);
    this.error.set(null);
    this.formulario.reset({
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol,
      passwordTemporal: '',
    });
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
    this.enEdicion.set(null);
  }

  async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    try {
      const datos = this.formulario.getRawValue();
      const enEdicion = this.enEdicion();

      if (enEdicion) {
        await this.ejecutar(
          this.servicio.actualizar(enEdicion.id, {
            nombreCompleto: datos.nombreCompleto,
            correo: datos.correo,
            rol: datos.rol,
          }),
        );
      } else {
        const creado = await this.ejecutar(
          this.servicio.crear({
            nombreCompleto: datos.nombreCompleto,
            correo: datos.correo,
            rol: datos.rol,
            ...(datos.passwordTemporal
              ? { passwordTemporal: datos.passwordTemporal }
              : {}),
          }),
        );
        this.credenciales.set({
          correo: creado.usuario.correo,
          password: creado.passwordTemporal,
        });
      }

      this.cerrarPanel();
      await this.cargar();
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarEstado(usuario: Usuario): Promise<void> {
    const estado: EstadoUsuario =
      usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.error.set(null);
    try {
      await this.ejecutar(this.servicio.cambiarEstado(usuario.id, estado));
      await this.cargar();
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    }
  }

  async restablecerPassword(usuario: Usuario): Promise<void> {
    this.error.set(null);
    try {
      const respuesta = await this.ejecutar(
        this.servicio.restablecerPassword(usuario.id),
      );
      this.credenciales.set({
        correo: respuesta.usuario.correo,
        password: respuesta.passwordTemporal,
      });
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    }
  }

  cerrarCredenciales(): void {
    this.credenciales.set(null);
  }

  iniciales(usuario: Usuario): string {
    return usuario.nombreCompleto
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  }

  /** Convierte un Observable en promesa para poder usar async/await. */
  private ejecutar<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(observable);
  }
}
