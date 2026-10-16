import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/errores';
import {
  FASES_INSPECCION,
  clasificarPorAves,
  galponesSugeridos,
  indicadoresAplicables,
  numerosSugeridos,
  pesosDe,
  type GrupoProductivo,
  type InspeccionRespuesta,
  type PeticionGuardarInspeccion,
  type SistemaProduccion,
} from '../../core/inspeccion/inspeccion.modelos';
import {
  entero,
  mensajeEntero,
  numerosUnicos,
  valorEntero,
} from '../../core/validadores';
import { SincronizacionService } from '../../core/visitas/sincronizacion.service';
import {
  TONO_ESTADO,
  type TipoPredio,
  type Visita,
} from '../../core/visitas/visitas.modelos';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';
import { EncabezadoPaginaComponent } from '../../shared/ui/encabezado-pagina/encabezado-pagina.component';
import { EstadoVacioComponent } from '../../shared/ui/estado-vacio/estado-vacio.component';
import { EsqueletoComponent } from '../../shared/ui/esqueleto/esqueleto.component';
import { InsigniaComponent } from '../../shared/ui/insignia/insignia.component';
import { TarjetaComponent } from '../../shared/ui/tarjeta/tarjeta.component';
import type { EvaluacionFase2 } from '../../core/inspeccion/fase2.modelos';
import type { DocumentoEvaluado } from '../../core/inspeccion/fase3.modelos';
import { Fase2GalponComponent } from './fase2-galpon.component';
import { Fase3DocumentalComponent } from './fase3-documental.component';

/** Campos de un galpón en el formulario (RF16). */
interface GalponForm {
  numero: FormControl<number | string>;
  edadSemanas: FormControl<number | string | null>;
  aves: FormControl<number | string | null>;
  seleccionado: FormControl<boolean>;
}

/**
 * Apertura y ficha general, Fase I de la inspección (M3 · RF13–RF17).
 *
 * Monta la sección «Inspección» con las cuatro fases del wireframe; en M3 solo
 * la Fase I está construida (las demás son marcadores). Desde aquí se registra
 * la ficha del predio y del responsable, el sistema se clasifica solo por el
 * número de aves (RF14), se elige el grupo productivo (RF15), se registran los
 * galpones (RF16) y se ven los indicadores que aplican (RF17).
 *
 * Los cambios se guardan por la cola de sincronización (RF12): primero en el
 * equipo y luego en el servidor.
 */
@Component({
  selector: 'app-inspeccion',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    AvisoComponent,
    EncabezadoPaginaComponent,
    EstadoVacioComponent,
    EsqueletoComponent,
    Fase2GalponComponent,
    Fase3DocumentalComponent,
    InsigniaComponent,
    TarjetaComponent,
  ],
  templateUrl: './inspeccion.component.html',
})
export class InspeccionComponent {
  readonly sincronizacion = inject(SincronizacionService);
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly fases = FASES_INSPECCION;
  readonly tonoEstado = TONO_ESTADO;

  /** Visita que se está inspeccionando; sin ella se muestra el selector. */
  readonly visitaId = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly respuesta = signal<InspeccionRespuesta | null>(null);
  /** Visitas que se pueden inspeccionar, para el selector (RF13). */
  readonly abiertas = signal<Visita[]>([]);
  readonly faseActiva = signal(1);

  readonly ficha = this.fb.group({
    nombrePredio: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(150),
    ]),
    municipio: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(120),
    ]),
    vereda: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    responsable: this.fb.nonNullable.control('', [
      Validators.minLength(3),
      Validators.maxLength(150),
    ]),
    numeroAves: this.fb.control<number | string | null>(null, [
      entero({ min: 0, max: 10_000_000 }),
    ]),
    sistemaProduccion: this.fb.nonNullable.control<SistemaProduccion | ''>(''),
    fecha: this.fb.nonNullable.control(''),
    hora: this.fb.nonNullable.control(''),
    grupoProductivo: this.fb.nonNullable.control<GrupoProductivo | ''>(''),
    observaciones: this.fb.nonNullable.control('', [
      Validators.maxLength(2000),
    ]),
    galpones: this.fb.array<FormGroup<GalponForm>>([], {
      validators: [numerosUnicos()],
    }),
  });

  /** Mensajes de error de campos enteros, para el marcado. */
  readonly mensajeEntero = mensajeEntero;

  /** Valor actual del formulario, para los cálculos de la pantalla. */
  private readonly valor = toSignal(
    this.ficha.valueChanges.pipe(map(() => this.ficha.getRawValue())),
    { initialValue: this.ficha.getRawValue() },
  );

  /** Clasificación automática según el número de aves (RF14). */
  readonly clasificacion = computed<TipoPredio | null>(() => {
    const aves = valorEntero(this.valor().numeroAves);
    return aves === null ? null : clasificarPorAves(aves);
  });

  /** Tipo que se muestra: el clasificado o, mientras no haya aves, el declarado. */
  readonly tipoMostrado = computed<TipoPredio>(
    () =>
      this.clasificacion() ?? this.respuesta()?.predio.tipoPredio ?? 'CORRAL',
  );

  /** Pesos que se aplican al predio (RF14). */
  readonly pesos = computed(() =>
    pesosDe(this.respuesta()?.catalogo, this.tipoMostrado()),
  );

  /** Indicadores que aplican al grupo productivo elegido (RF17). */
  readonly indicadores = computed(() =>
    indicadoresAplicables(
      this.respuesta()?.catalogo,
      this.valor().grupoProductivo,
    ),
  );

  /** Etiqueta del grupo productivo elegido (RF15). */
  readonly etiquetaGrupo = computed(() => {
    const codigo = this.valor().grupoProductivo;
    return (
      this.respuesta()?.catalogo.gruposProductivos.find(
        (opcion) => opcion.codigo === codigo,
      )?.etiqueta ?? ''
    );
  });

  /** Cómo se leerían los pesos si el predio fuera traspatio (RF14). */
  readonly textoPesosTraspatio = computed(() =>
    (this.respuesta()?.catalogo.pesosTraspatio ?? [])
      .map((peso) =>
        peso.peso === 0
          ? `${peso.grupo} no aplica`
          : `${peso.grupo} ${peso.peso} %`,
      )
      .join(' · '),
  );

  /** Números de galpón que la metodología sugiere evaluar (RF16). */
  readonly sugeridos = computed(() => {
    const aves = valorEntero(this.valor().numeroAves);
    const galpones = this.valor().galpones.map((galpon) => ({
      numero: valorEntero(galpon.numero) ?? 0,
      edadSemanas: valorEntero(galpon.edadSemanas),
    }));
    return numerosSugeridos(galpones, aves);
  });

  /** Cuántos galpones sugiere la metodología, si ya hay número de aves (RF16). */
  readonly galponesSugeridos = computed(() => {
    const aves = valorEntero(this.valor().numeroAves);
    return aves === null ? null : galponesSugeridos(aves);
  });

  readonly puedeGuardar = computed(
    () => this.respuesta()?.visita.estado !== 'CERRADA',
  );

  /** Fase activa, para la línea de contexto y las pestañas. */
  readonly faseActivaObj = computed(
    () =>
      this.fases.find((fase) => fase.numero === this.faseActiva()) ??
      this.fases[0],
  );

  /** Galpones marcados para inspeccionar, para el resumen (RF16). */
  readonly galponesMarcados = computed(
    () => this.valor().galpones.filter((galpon) => galpon.seleccionado).length,
  );

  /** Número de aves registrado, para el resumen (RF14). */
  readonly avesRegistradas = computed(() =>
    valorEntero(this.valor().numeroAves),
  );

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = parametros.get('visitaId');
      this.visitaId.set(id);
      if (id) {
        void this.cargar(id);
      } else {
        void this.cargarAbiertas();
      }
    });
  }

  get galpones() {
    return this.ficha.controls.galpones;
  }

  // ---------------------------------------------------------------- carga

  /** Carga la ficha de una visita (RF13–RF17). */
  async cargar(visitaId: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const respuesta = await this.sincronizacion.cargarInspeccion(visitaId);
      if (!respuesta) {
        this.error.set('No se encontró la visita o no está a su cargo.');
        this.respuesta.set(null);
        return;
      }
      this.respuesta.set(respuesta);
      this.rellenarFormulario(respuesta);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Visitas abiertas del inspector, para elegir cuál inspeccionar. */
  private async cargarAbiertas(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const lista = await this.sincronizacion.listar({ porPagina: 50 });
      this.abiertas.set(
        lista.datos.filter((visita) => visita.estado !== 'CERRADA'),
      );
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.cargando.set(false);
    }
  }

  private rellenarFormulario(respuesta: InspeccionRespuesta): void {
    const { fecha, hora } = this.partirFecha(respuesta.ficha.fechaHora);
    this.ficha.patchValue({
      nombrePredio: respuesta.predio.nombre,
      municipio: respuesta.predio.municipio,
      vereda: respuesta.predio.vereda,
      responsable: respuesta.predio.responsable ?? '',
      numeroAves: respuesta.predio.numeroAves,
      sistemaProduccion: respuesta.predio.sistemaProduccion ?? '',
      fecha,
      hora,
      grupoProductivo: respuesta.ficha.grupoProductivo ?? '',
      observaciones: respuesta.ficha.observaciones ?? '',
    });

    this.galpones.clear();
    for (const galpon of respuesta.galpones) {
      this.galpones.push(
        this.crearGrupoGalpon({
          numero: galpon.numero,
          edadSemanas: galpon.edadSemanas,
          aves: galpon.aves,
          seleccionado: galpon.seleccionado,
        }),
      );
    }
  }

  // -------------------------------------------------------------- acciones

  /** Elige el grupo productivo (RF15). */
  elegirGrupo(codigo: string): void {
    this.ficha.controls.grupoProductivo.setValue(codigo as GrupoProductivo);
  }

  /** Agrega un galpón a la ficha (RF16). */
  agregarGalpon(): void {
    const numeros = this.galpones.controls
      .map((control) => valorEntero(control.controls.numero.value))
      .filter((numero): numero is number => numero !== null);
    const siguiente = numeros.length === 0 ? 1 : Math.max(...numeros) + 1;
    this.galpones.push(
      this.crearGrupoGalpon({
        numero: siguiente,
        edadSemanas: null,
        aves: null,
        seleccionado: false,
      }),
    );
  }

  /** Quita un galpón de la ficha (RF16). */
  quitarGalpon(indice: number): void {
    this.galpones.removeAt(indice);
  }

  /** ¿La metodología sugiere evaluar este galpón? (RF16). */
  esSugerido(numero: number | string | null): boolean {
    const valor = valorEntero(numero);
    return valor !== null && this.sugeridos().includes(valor);
  }

  /** Marca o desmarca un galpón para inspeccionar (RF16). */
  alternarGalpon(indice: number): void {
    const control = this.galpones.at(indice).controls.seleccionado;
    control.setValue(!control.value);
  }

  /**
   * ¿La fase ya quedó lista? Fase I: ficha guardada. Fase II: todos los
   * indicadores de los galpones marcados, completos o con «No aplica» (RF24).
   * Fase III: todos los documentos calificados o marcados pendientes (RF31).
   * Es lo que pinta la pestaña con el visto bueno del wireframe.
   */
  faseCompleta(numero: number): boolean {
    const respuesta = this.respuesta();
    if (!respuesta) return false;
    if (numero === 1) return respuesta.ficha.guardada;
    if (numero === 2) {
      const avance = respuesta.fase2.avance;
      return (
        avance.length > 0 &&
        avance.every((galpon) =>
          galpon.grupos.every(
            (grupo) => grupo.total > 0 && grupo.completos === grupo.total,
          ),
        )
      );
    }
    if (numero === 3) {
      const avance = respuesta.fase3.avance;
      return avance.total > 0 && avance.verificados === avance.total;
    }
    return false;
  }

  /**
   * ¿La fase no aplica a este predio? La documental no existe en traspatio
   * (RF33), así que su pestaña queda como las que aún no se construyen.
   */
  faseNoAplica(fase: (typeof FASES_INSPECCION)[number]): boolean {
    return (
      fase.numero === 3 && this.respuesta()?.ficha.tipoPredio === 'TRASPATIO'
    );
  }

  /** Clases de una pestaña de fase, como en el wireframe. */
  claseFase(fase: (typeof FASES_INSPECCION)[number]): string {
    const usable = fase.disponible && !this.faseNoAplica(fase);
    if (usable && this.faseActiva() === fase.numero) {
      return 'bg-marca text-marca-contraste';
    }
    if (usable && this.faseCompleta(fase.numero)) {
      return 'bg-acento text-acento-contraste hover:bg-acento-fuerte';
    }
    if (usable) {
      return 'border border-borde bg-superficie text-contenido-suave hover:bg-superficie-alterna';
    }
    return 'border border-borde bg-superficie text-contenido-deshabilitado';
  }

  /** Abre una pestaña de fase, o explica por qué no se puede abrir. */
  abrirFase(fase: (typeof FASES_INSPECCION)[number]): void {
    if (!fase.disponible) {
      this.faseNoDisponible(fase);
      return;
    }
    if (this.faseNoAplica(fase)) {
      this.aviso.set(
        'En traspatio no hay fase documental ni indicadores de gestión (RF33).',
      );
      return;
    }
    this.faseActiva.set(fase.numero);
  }

  /** Guarda el borrador; con `iniciar`, además pone la visita en curso (RF09). */
  async guardar(iniciar = false): Promise<void> {
    const visitaId = this.visitaId();
    if (!visitaId) return;

    if (this.ficha.invalid) {
      this.ficha.markAllAsTouched();
      this.error.set('Revise los campos marcados en rojo.');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const resultado = await this.sincronizacion.guardarInspeccion(
        visitaId,
        this.aPeticion(),
      );

      if (iniciar) {
        const estado = this.respuesta()?.visita.estado;
        if (estado === 'PROGRAMADA') {
          await this.sincronizacion.iniciarInspeccion(
            visitaId,
            this.ficha.controls.nombrePredio.value,
          );
        }
      }

      if (resultado.pendiente) {
        this.aviso.set(
          'Guardado en este equipo. Se enviará solo cuando vuelva la conexión.',
        );
      } else if (resultado.rechazos.length > 0) {
        this.error.set(resultado.rechazos.join(' '));
      } else {
        this.aviso.set(
          iniciar
            ? 'Inspección iniciada. La visita queda en curso.'
            : 'Borrador guardado.',
        );
      }

      await this.cargar(visitaId);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Muestra el aviso de que las demás fases llegan en otros módulos. */
  faseNoDisponible(fase: (typeof FASES_INSPECCION)[number]): void {
    this.aviso.set(
      `La fase «${fase.etiqueta}» se construye en el módulo ${fase.modulo}.`,
    );
  }

  /**
   * Guarda las evaluaciones de la Fase II (M4 · RF18–RF26). Va por la misma
   * cola que la ficha (RF12), así que también funciona sin conexión; queda la
   * fecha y la hora de cada guardado (RF26).
   */
  async guardarFase2(evaluaciones: EvaluacionFase2[]): Promise<void> {
    const visitaId = this.visitaId();
    if (!visitaId) return;

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const resultado = await this.sincronizacion.guardarInspeccion(visitaId, {
        evaluaciones,
      });

      if (resultado.pendiente) {
        this.aviso.set(
          'Guardado en este equipo. Se enviará solo cuando vuelva la conexión.',
        );
      } else if (resultado.rechazos.length > 0) {
        this.error.set(resultado.rechazos.join(' '));
      } else {
        this.aviso.set('Borrador guardado con su fecha y hora.');
      }

      await this.cargar(visitaId);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Recarga la inspección; la usa la Fase II tras subir o borrar una foto. */
  async recargar(): Promise<void> {
    const visitaId = this.visitaId();
    if (visitaId) await this.cargar(visitaId);
  }

  /**
   * Guarda las verificaciones de la Fase III (M5 · RF27–RF33). Va por la misma
   * cola que la ficha (RF12), así que también funciona sin conexión; queda la
   * fecha y la hora de cada guardado (RF26).
   */
  async guardarFase3(documentos: DocumentoEvaluado[]): Promise<void> {
    const visitaId = this.visitaId();
    if (!visitaId) return;

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const resultado = await this.sincronizacion.guardarInspeccion(visitaId, {
        documentos,
      });

      if (resultado.pendiente) {
        this.aviso.set(
          'Guardado en este equipo. Se enviará solo cuando vuelva la conexión.',
        );
      } else if (resultado.rechazos.length > 0) {
        this.error.set(resultado.rechazos.join(' '));
      } else {
        this.aviso.set('Borrador guardado con su fecha y hora.');
      }

      await this.cargar(visitaId);
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.guardando.set(false);
    }
  }

  // ------------------------------------------------------------- internos

  private crearGrupoGalpon(galpon: {
    numero: number;
    edadSemanas: number | null;
    aves: number | null;
    seleccionado: boolean;
  }): FormGroup<GalponForm> {
    return this.fb.group<GalponForm>({
      numero: this.fb.nonNullable.control(galpon.numero, {
        validators: [entero({ min: 1, max: 99, requerido: true })],
      }),
      edadSemanas: this.fb.control<number | string | null>(galpon.edadSemanas, {
        validators: [entero({ min: 0, max: 10_000 })],
      }),
      aves: this.fb.control<number | string | null>(galpon.aves, {
        validators: [entero({ min: 0, max: 10_000_000 })],
      }),
      seleccionado: this.fb.nonNullable.control(galpon.seleccionado),
    });
  }

  /** Arma lo que se envía al servidor; solo lo que el inspector registró. */
  private aPeticion(): PeticionGuardarInspeccion {
    const valor = this.ficha.getRawValue();
    const peticion: PeticionGuardarInspeccion = {
      nombrePredio: valor.nombrePredio.trim(),
      municipio: valor.municipio.trim(),
      vereda: valor.vereda.trim(),
      observaciones: valor.observaciones.trim(),
      galpones: valor.galpones.map((galpon) => {
        const edadSemanas = valorEntero(galpon.edadSemanas);
        const aves = valorEntero(galpon.aves);
        return {
          numero: valorEntero(galpon.numero) ?? 0,
          seleccionado: galpon.seleccionado,
          ...(edadSemanas === null ? {} : { edadSemanas }),
          ...(aves === null ? {} : { aves }),
        };
      }),
    };

    const responsable = valor.responsable.trim();
    if (responsable.length >= 3) peticion.responsable = responsable;
    const numeroAves = valorEntero(valor.numeroAves);
    if (numeroAves !== null) peticion.numeroAves = numeroAves;
    if (valor.sistemaProduccion) {
      peticion.sistemaProduccion = valor.sistemaProduccion;
    }
    if (valor.grupoProductivo) {
      peticion.grupoProductivo = valor.grupoProductivo;
    }
    const fechaHora = this.unirFecha(valor.fecha, valor.hora);
    if (fechaHora) peticion.fechaHora = fechaHora;

    return peticion;
  }

  /** Junta la fecha y la hora del formulario en un instante (hora local). */
  private unirFecha(fecha: string, hora: string): string | null {
    if (!fecha) return null;
    const instante = new Date(`${fecha}T${hora || '00:00'}:00`);
    return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
  }

  /** Separa un instante en fecha y hora para los campos del formulario. */
  private partirFecha(iso: string | null): { fecha: string; hora: string } {
    if (!iso) return { fecha: '', hora: '' };
    const instante = new Date(iso);
    if (Number.isNaN(instante.getTime())) return { fecha: '', hora: '' };
    const dosDigitos = (numero: number) => String(numero).padStart(2, '0');
    return {
      fecha: `${instante.getFullYear()}-${dosDigitos(instante.getMonth() + 1)}-${dosDigitos(instante.getDate())}`,
      hora: `${dosDigitos(instante.getHours())}:${dosDigitos(instante.getMinutes())}`,
    };
  }

  /** Nombre del inspector de la sesión, para el encabezado. */
  readonly inspector = computed(
    () =>
      this.respuesta()?.visita.inspector ??
      this.auth.usuario()?.nombreCompleto ??
      '',
  );
}
