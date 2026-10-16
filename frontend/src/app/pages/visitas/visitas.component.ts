import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISOS } from '../../core/auth/auth.modelos';
import { UsuariosService } from '../../core/usuarios/usuarios.service';
import { SincronizacionService } from '../../core/visitas/sincronizacion.service';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO_PREDIO,
  PESTANAS_VISITAS,
  TONO_ESTADO,
  type EstadoVisita,
  type FiltrosVisitas,
  type ListaVisitas,
  type Predio,
  type TipoPredio,
  type Visita,
} from '../../core/visitas/visitas.modelos';
import {
  AvisoComponent,
  EncabezadoPaginaComponent,
  EstadoVacioComponent,
  InsigniaComponent,
  NotificacionService,
  TarjetaComponent,
  ConfirmacionService,
} from '../../shared/ui';

/** Cuántas visitas se piden por página. */
const POR_PAGINA = 10;

/**
 * Gestión de visitas (M2 · RF08–RF12).
 *
 * Lista con búsqueda, filtros (RF11) y pestañas por estado; programación y
 * edición en un panel lateral (RF08); cambio de estado (RF09). Todo pasa por
 * `SincronizacionService`, así que funciona igual con o sin conexión (RF12).
 */
@Component({
  selector: 'app-visitas',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    AvisoComponent,
    EncabezadoPaginaComponent,
    EstadoVacioComponent,
    InsigniaComponent,
    TarjetaComponent,
  ],
  templateUrl: './visitas.component.html',
  styleUrl: './visitas.component.scss',
})
export class VisitasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuariosService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly sincronizacion = inject(SincronizacionService);

  // Constantes que usa el marcado.
  readonly pestanas = PESTANAS_VISITAS;
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly etiquetaTipoPredio = ETIQUETA_TIPO_PREDIO;
  readonly tonoEstado = TONO_ESTADO;

  // ------------------------------------------------------------- estado
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly lista = signal<ListaVisitas | null>(null);
  readonly pagina = signal(1);
  readonly estado = signal<'todas' | EstadoVisita>('todas');
  readonly busqueda = signal('');
  readonly municipio = signal('');
  readonly tipoPredio = signal<'' | TipoPredio>('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly filtrosAbiertos = signal(false);
  readonly municipios = signal<string[]>([]);
  readonly predios = signal<Predio[]>([]);
  readonly inspectores = signal<{ id: string; nombre: string }[]>([]);

  // ------------------------------------------------------------- panel
  readonly panelAbierto = signal(false);
  readonly esEdicion = signal(false);
  readonly visitaEnEdicion = signal<Visita | null>(null);
  readonly guardando = signal(false);

  readonly puedeCrear = computed(() => this.auth.puede(PERMISOS.VISITAS_CREAR));
  readonly esAdministrador = computed(
    () => this.auth.usuario()?.rol === 'ADMINISTRADOR',
  );
  readonly totalPaginas = computed(() => {
    const total = this.lista()?.total ?? 0;
    return Math.max(1, Math.ceil(total / POR_PAGINA));
  });
  readonly hayFiltros = computed(
    () =>
      this.busqueda() !== '' ||
      this.municipio() !== '' ||
      this.tipoPredio() !== '' ||
      this.desde() !== '' ||
      this.hasta() !== '',
  );

  readonly formulario = this.fb.group({
    modoPredio: ['existente' as 'existente' | 'nuevo', Validators.required],
    predioId: [''],
    nombre: [''],
    municipio: [''],
    vereda: [''],
    tipoPredio: ['CORRAL' as TipoPredio],
    inspectorId: [''],
    fecha: ['', Validators.required],
    hora: ['', Validators.required],
    observaciones: [''],
  });

  ngOnInit(): void {
    void this.cargar();
  }

  /** Espera a que la persona deje de escribir antes de consultar (RF11). */
  private readonly busquedaCambios = new Subject<void>();

  constructor() {
    this.busquedaCambios
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => {
        this.pagina.set(1);
        void this.cargar();
      });
  }

  // ------------------------------------------------------------- listado

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const lista = await this.sincronizacion.listar(this.filtros());
      this.lista.set(lista);
    } catch (fallo) {
      this.error.set(
        'No se pudieron cargar las visitas. Se muestran los datos guardados en el equipo.',
      );
      void fallo;
    } finally {
      this.cargando.set(false);
    }
  }

  private filtros(): FiltrosVisitas {
    const estado = this.estado();
    return {
      pagina: this.pagina(),
      porPagina: POR_PAGINA,
      busqueda: this.busqueda() || undefined,
      municipio: this.municipio() || undefined,
      estado: estado === 'todas' ? undefined : estado,
      tipoPredio: this.tipoPredio() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    };
  }

  buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
    this.busquedaCambios.next();
  }

  /** Abre la lista de predios registrados la primera vez que se despliega. */
  alAbrirPredios(abierto: boolean): void {
    if (abierto && this.predios().length === 0) {
      void this.buscarPredios('');
    }
  }

  cambiarPestana(clave: 'todas' | EstadoVisita): void {
    this.estado.set(clave);
    this.pagina.set(1);
    void this.cargar();
  }

  cambiarPagina(delta: number): void {
    this.pagina.set(Math.max(1, this.pagina() + delta));
    void this.cargar();
  }

  alternarFiltros(): void {
    this.filtrosAbiertos.set(!this.filtrosAbiertos());
    if (this.filtrosAbiertos() && this.municipios().length === 0) {
      void this.cargarMunicipios();
    }
  }

  private async cargarMunicipios(): Promise<void> {
    this.municipios.set(await this.sincronizacion.cargarMunicipios());
  }

  aplicarFiltros(): void {
    this.pagina.set(1);
    void this.cargar();
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.municipio.set('');
    this.tipoPredio.set('');
    this.desde.set('');
    this.hasta.set('');
    this.pagina.set(1);
    void this.cargar();
  }

  /** Cantidad que muestra la pestaña. */
  cantidadPestana(clave: 'todas' | EstadoVisita): number {
    const conteos = this.lista()?.conteos;
    if (!conteos) return 0;
    switch (clave) {
      case 'todas':
        return conteos.todas;
      case 'EN_CURSO':
        return conteos.enCurso;
      case 'PENDIENTE_DOCUMENTOS':
        return conteos.pendientesDocumentos;
      case 'CERRADA':
        return conteos.cerradas;
      default:
        return conteos.programadas;
    }
  }

  // ------------------------------------------------------------- cambios

  async cambiarEstado(visita: Visita, estado: EstadoVisita): Promise<void> {
    if (
      estado === 'CERRADA' &&
      !(await this.confirmacion.confirmar({
        titulo: 'Cerrar la visita',
        mensaje: `¿Cerrar la visita de ${visita.predio.nombre}? Una visita cerrada ya no se puede editar.`,
        textoConfirmar: 'Cerrar visita',
      }))
    ) {
      return;
    }

    const resultado = await this.sincronizacion.cambiarEstado(visita, estado);
    this.informar(
      resultado.pendiente,
      resultado.rechazos,
      'Estado actualizado.',
    );
    await this.cargar();
  }

  async sincronizarAhora(): Promise<void> {
    try {
      const resultados = await this.sincronizacion.sincronizar();
      const rechazos = resultados.filter(
        (resultado) => resultado.estado === 'RECHAZADA',
      );
      if (rechazos.length > 0) {
        this.notificaciones.error(
          `Algunas operaciones no se pudieron aplicar: ${rechazos
            .map((rechazo) => rechazo.motivo)
            .join(' ')}`,
        );
      } else {
        this.notificaciones.exito('Datos sincronizados.');
      }
      await this.cargar();
    } catch {
      this.notificaciones.advertencia(
        'No se pudo sincronizar. Se intentará de nuevo al recuperar la conexión.',
      );
    }
  }

  // --------------------------------------------------------------- panel

  abrirNueva(): void {
    this.esEdicion.set(false);
    this.visitaEnEdicion.set(null);
    this.formulario.reset({
      modoPredio: 'existente',
      predioId: '',
      nombre: '',
      municipio: '',
      vereda: '',
      tipoPredio: 'CORRAL',
      inspectorId: '',
      fecha: hoy(),
      hora: '09:00',
      observaciones: '',
    });
    this.panelAbierto.set(true);
    void this.cargarOpcionesDelPanel();
  }

  abrirEdicion(visita: Visita): void {
    this.esEdicion.set(true);
    this.visitaEnEdicion.set(visita);
    const fecha = new Date(visita.programadaPara);
    this.formulario.reset({
      modoPredio: 'existente',
      predioId: visita.predio.id,
      nombre: '',
      municipio: '',
      vereda: '',
      tipoPredio: visita.predio.tipoPredio,
      inspectorId: visita.inspector.id,
      fecha: fechaLocal(fecha),
      hora: horaLocal(fecha),
      observaciones: visita.observaciones ?? '',
    });
    this.panelAbierto.set(true);
    void this.cargarOpcionesDelPanel();
  }

  private async cargarOpcionesDelPanel(): Promise<void> {
    if (!this.esAdministrador()) return;
    if (this.inspectores().length > 0) return;
    try {
      const lista = await firstValueFrom(
        this.usuarios.listar({ rol: 'INSPECTOR', porPagina: 100 }),
      );
      this.inspectores.set(
        lista.datos
          .filter((usuario) => usuario.estado === 'ACTIVO')
          .map((usuario) => ({
            id: usuario.id,
            nombre: usuario.nombreCompleto,
          })),
      );
    } catch {
      this.inspectores.set([]);
    }
  }

  /** Predios existentes, para elegir uno (RF08). */
  async buscarPredios(texto: string): Promise<void> {
    this.predios.set(await this.sincronizacion.cargarPredios(texto));
  }

  usarPredioExistente(): boolean {
    return this.formulario.controls.modoPredio.value === 'existente';
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  async guardar(): Promise<void> {
    const valores = this.formulario.getRawValue();
    const fecha = new Date(`${valores.fecha}T${valores.hora}:00`);

    if (Number.isNaN(fecha.getTime())) {
      this.notificaciones.error('Indique la fecha y la hora de la visita.');
      return;
    }

    if (this.esEdicion()) {
      const visita = this.visitaEnEdicion();
      if (!visita) return;
      this.guardando.set(true);
      const resultado = await this.sincronizacion.editar(visita.id, {
        programadaPara: fecha.toISOString(),
        observaciones: valores.observaciones ?? '',
        inspectorId: this.esAdministrador()
          ? valores.inspectorId || undefined
          : undefined,
      });
      this.guardando.set(false);
      this.cerrarPanel();
      this.informar(
        resultado.pendiente,
        resultado.rechazos,
        'Visita actualizada.',
      );
      await this.cargar();
      return;
    }

    const nuevo = this.usarPredioExistente();
    if (nuevo && !valores.predioId) {
      this.notificaciones.error('Elija el predio de la visita.');
      return;
    }
    if (!nuevo && (!valores.nombre || !valores.municipio || !valores.vereda)) {
      this.notificaciones.error(
        'Complete el nombre, el municipio y la vereda del predio.',
      );
      return;
    }

    this.guardando.set(true);
    const resultado = await this.sincronizacion.programar({
      predioId: nuevo ? (valores.predioId ?? undefined) : undefined,
      predio: nuevo
        ? undefined
        : {
            nombre: valores.nombre ?? '',
            municipio: valores.municipio ?? '',
            vereda: valores.vereda ?? '',
            tipoPredio: valores.tipoPredio ?? 'CORRAL',
          },
      inspectorId: this.esAdministrador()
        ? valores.inspectorId || undefined
        : undefined,
      programadaPara: fecha.toISOString(),
      observaciones: valores.observaciones ?? undefined,
    });
    this.guardando.set(false);
    this.cerrarPanel();
    this.informar(
      resultado.pendiente,
      resultado.rechazos,
      'Visita programada.',
    );
    await this.cargar();
  }

  /** Avisa al usuario según lo que pasó con el cambio (RF12). */
  private informar(
    pendiente: boolean,
    rechazos: string[],
    mensajeExito: string,
  ): void {
    if (rechazos.length > 0) {
      this.notificaciones.error(rechazos.join(' '));
      return;
    }
    if (pendiente) {
      this.notificaciones.info(
        'El cambio quedó guardado en este equipo y se enviará al recuperar la conexión.',
      );
      return;
    }
    this.notificaciones.exito(mensajeExito);
  }
}

/** Fecha de hoy en formato `aaaa-mm-dd` (para el campo de fecha). */
function hoy(): string {
  return fechaLocal(new Date());
}

/** Parte de fecha local de un instante. */
function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Parte de hora local de un instante. */
function horaLocal(fecha: Date): string {
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}
