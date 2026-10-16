import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/errores';
import { camposIguales } from '../../core/validadores';
import { SincronizacionService } from '../../core/visitas/sincronizacion.service';
import type {
  Clasificacion,
  ConteoClasificacion,
  Visita,
} from '../../core/visitas/visitas.modelos';
import {
  AvisoComponent,
  EncabezadoPaginaComponent,
  EstadoVacioComponent,
  GraficaComponent,
  InsigniaComponent,
  TarjetaComponent,
} from '../../shared/ui';

/** Tarjeta de indicador del panel. */
interface Indicador {
  etiqueta: string;
  valor: string;
  detalle: string;
  icono: string;
}

/** Color de la escala de clasificación para la dona (token de diseño). */
const TOKENS_CLASIFICACION: Record<Clasificacion, string> = {
  EXCELENTE: 'nivel-excelente',
  ALTO: 'nivel-alto',
  MEDIO: 'nivel-medio',
  BAJO: 'nivel-bajo',
};

/**
 * Clase del punto de color de la leyenda. Se escribe completa (y no armada en
 * tiempo de ejecución) para que Tailwind la detecte al compilar.
 */
const CLASES_CLASIFICACION: Record<Clasificacion, string> = {
  EXCELENTE: 'bg-nivel-excelente',
  ALTO: 'bg-nivel-alto',
  MEDIO: 'bg-nivel-medio',
  BAJO: 'bg-nivel-bajo',
};

/**
 * Panel principal (M2 · RF10).
 *
 * Muestra los indicadores de la evaluación (visitas del mes, calificación
 * promedio, documentos pendientes y registros sin sincronizar), la evolución de
 * la calificación, la distribución por clasificación, el promedio por grupo de
 * medidas y las próximas visitas.
 *
 * Los cálculos los hace el servidor; aquí solo se dibujan. Lo que todavía no
 * tiene fuente (el promedio por grupo, que llega con el motor de cálculo M6)
 * se muestra con su explicación, no con un cero engañoso.
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AvisoComponent,
    EncabezadoPaginaComponent,
    EstadoVacioComponent,
    GraficaComponent,
    InsigniaComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TarjetaComponent,
  ],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly sincronizacion = inject(SincronizacionService);
  private readonly router = inject(Router);

  // ------------------------------------------------- indicadores (RF10)
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly resumen = computed(() => this.sincronizacion.resumenLocal());

  readonly indicadores = computed<Indicador[]>(() => {
    const resumen = this.resumen();
    const variacion = resumen?.variacionVisitas ?? null;

    return [
      {
        etiqueta: 'Visitas del mes',
        valor: String(resumen?.visitasDelMes ?? 0),
        detalle:
          variacion === null
            ? 'Sin mes anterior para comparar'
            : `${variacion >= 0 ? '+' : ''}${variacion} % frente al mes pasado`,
        icono: 'event_available',
      },
      {
        etiqueta: 'Calificación promedio',
        valor:
          resumen?.calificacionPromedio === undefined ||
          resumen?.calificacionPromedio === null
            ? '—'
            : resumen.calificacionPromedio.toFixed(1),
        detalle:
          resumen?.etiquetaClasificacionPromedio === null ||
          resumen?.etiquetaClasificacionPromedio === undefined
            ? 'Todavía no hay visitas con resultado'
            : `Nivel ${resumen.etiquetaClasificacionPromedio.toLowerCase()} · sobre 100`,
        icono: 'grade',
      },
      {
        etiqueta: 'Pendientes de documentos',
        valor: String(resumen?.documentosPendientes ?? 0),
        detalle: 'Visitas esperando soportes del productor',
        icono: 'folder_open',
      },
      {
        etiqueta: 'Sin sincronizar',
        valor: String(this.sincronizacion.pendientes()),
        detalle: 'Registros guardados en este equipo',
        icono: 'cloud_off',
      },
    ];
  });

  // ------------------------------------------------------- gráficas (RF10)
  readonly etiquetasEvolucion = computed(
    () => this.resumen()?.evolucion.map((punto) => punto.etiqueta) ?? [],
  );
  readonly valoresEvolucion = computed(
    () => this.resumen()?.evolucion.map((punto) => punto.calificacion) ?? [],
  );

  readonly distribucion = computed(() => this.resumen()?.distribucion ?? []);
  readonly etiquetasDistribucion = computed(() =>
    this.distribucion().map((conteo) => conteo.etiqueta),
  );
  readonly valoresDistribucion = computed(() =>
    this.distribucion().map((conteo) => conteo.cantidad),
  );
  readonly coloresDistribucion = computed(() =>
    this.distribucion().map(
      (conteo) => TOKENS_CLASIFICACION[conteo.clasificacion],
    ),
  );
  readonly totalClasificado = computed(() =>
    this.distribucion().reduce((suma, conteo) => suma + conteo.cantidad, 0),
  );
  /** Texto del centro de la dona. */
  readonly textoTotalClasificado = computed(() =>
    this.totalClasificado().toString(),
  );

  readonly etiquetasGrupos = computed(
    () => this.resumen()?.promedioPorGrupo.map((grupo) => grupo.etiqueta) ?? [],
  );
  readonly valoresGrupos = computed(
    () => this.resumen()?.promedioPorGrupo.map((grupo) => grupo.promedio) ?? [],
  );

  readonly proximas = computed<Visita[]>(() => this.resumen()?.proximas ?? []);

  /** Clase del punto de color de cada nivel. */
  readonly claseNivel = CLASES_CLASIFICACION;

  // ------------------------------------------------ acceso sin conexión (M1)
  readonly mostrarPin = signal(false);
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

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.sincronizacion.cargarResumen();
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  irAVisitas(): void {
    void this.router.navigate(['/visitas']);
  }

  /** Etiqueta amable de una próxima visita («Hoy · 9:00», «Mañana · 8:30»). */
  cuando(fecha: string): string {
    const momento = new Date(fecha);
    const hora = momento.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const dias = diasDeDiferencia(momento);
    if (dias === 0) return `Hoy · ${hora}`;
    if (dias === 1) return `Mañana · ${hora}`;
    return `${momento.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · ${hora}`;
  }

  /** Texto de la leyenda de la dona: «12 (50 %)». */
  conteoTexto(conteo: ConteoClasificacion): string {
    return `${conteo.cantidad} (${Math.round(conteo.porcentaje)} %)`;
  }

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
}

/** Días completos entre dos fechas (para «Hoy», «Mañana»). */
function diasDeDiferencia(objetivo: Date, hoy = new Date()): number {
  const diaObjetivo = new Date(
    objetivo.getFullYear(),
    objetivo.getMonth(),
    objetivo.getDate(),
  );
  const diaDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((diaObjetivo.getTime() - diaDeHoy.getTime()) / 86_400_000);
}
