import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from '../../core/http/errores';
import {
  MAXIMO_PUNTOS,
  PUNTAJE_MAX,
  PUNTAJE_MIN,
  avanceDe,
  claveEvaluacion,
  enRango,
  erroresDeEvaluacion,
  evaluacionVacia,
  indicadorCompleto,
  mensajeMuestra,
  promedioPuntos,
  puntajesDe,
  puntosRequeridos,
  reglasFase2,
  valorIndicador,
  type EvaluacionFase2,
  type Evidencia,
  type PuntoEvaluado,
} from '../../core/inspeccion/fase2.modelos';
import {
  indicadoresAplicables,
  type GrupoMedidas,
  type IndicadorCatalogo,
  type InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import { InspeccionService } from '../../core/inspeccion/inspeccion.service';
import { SincronizacionService } from '../../core/visitas/sincronizacion.service';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';
import { EstadoVacioComponent } from '../../shared/ui/estado-vacio/estado-vacio.component';
import { InsigniaComponent } from '../../shared/ui/insignia/insignia.component';
import { TarjetaComponent } from '../../shared/ui/tarjeta/tarjeta.component';

/** Tope de peso de una foto; igual que en el backend (RF23). */
const TAMANO_MAXIMO_FOTO = 8 * 1024 * 1024;

/** Tipos de foto admitidos; igual que en el backend (RF23). */
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** Orden de los grupos en la fase, como en el wireframe: MBR y luego MBA. */
const ORDEN_GRUPOS: readonly GrupoMedidas[] = ['MBR', 'MBA'];

/** Una fila de la lista de puntos de muestreo (RF18–RF21). */
interface FilaPunto {
  numero: number;
  punto: PuntoEvaluado;
  /** Mensaje de la muestra, si está fuera de rango (RF20). */
  mensaje: string | null;
  /** En jaula no se califica hasta contar las aves (RF21). */
  calificable: boolean;
}

/**
 * Inspección en galpón, Fase II (M4 · RF18–RF26).
 *
 * Reproduce el panel del wireframe: a la izquierda los indicadores del animal
 * (MBA) y de recursos (MBR) con su avance; en el centro el indicador activo con
 * sus 9 puntos de muestreo (o las hojas centinela), la foto y la observación;
 * a la derecha el cálculo en vivo (promedio, valor del indicador y avance del
 * galpón).
 *
 * Todo se diligencia primero en el equipo (RF12): la pantalla mantiene las
 * evaluaciones locales y las entrega a la página, que las guarda por la cola de
 * sincronización. Las fotos sí necesitan red: se suben directo al
 * almacenamiento con una URL firmada (RF23, ADR-003).
 */
@Component({
  selector: 'app-fase2-galpon',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    AvisoComponent,
    EstadoVacioComponent,
    InsigniaComponent,
    TarjetaComponent,
  ],
  templateUrl: './fase2-galpon.component.html',
})
export class Fase2GalponComponent {
  private readonly inspeccion = inject(InspeccionService);
  readonly sincronizacion = inject(SincronizacionService);

  /** Respuesta completa de la inspección (la trae la página). */
  readonly respuesta = input.required<InspeccionRespuesta>();
  /** Verdadero mientras la página está guardando. */
  readonly guardando = input(false);
  /** Pide guardar las evaluaciones de la Fase II (RF26). */
  readonly guardar = output<EvaluacionFase2[]>();
  /** Pide recargar la inspección (después de subir o borrar una foto). */
  readonly refrescar = output<void>();

  /** Valores de la escala, en el orden del wireframe: 2, 1 y 0 (RF19). */
  readonly puntajes = [PUNTAJE_MAX, PUNTAJE_MAX - 1, PUNTAJE_MIN];
  readonly maximoPuntos = MAXIMO_PUNTOS;

  readonly galponActivo = signal<number | null>(null);
  readonly indicadorActivo = signal<string | null>(null);
  /** Punto de muestreo seleccionado en el indicador activo (RF18). */
  readonly puntoActivo = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly subiendo = signal(false);

  /** Evaluaciones que se están diligenciando en este equipo (RF12). */
  private readonly evaluaciones = signal<Map<string, EvaluacionFase2>>(
    new Map(),
  );
  private visitaSembrada = '';

  /** Galpones marcados para inspeccionar en la Fase I (RF16). */
  readonly galponesSeleccionados = computed(() =>
    this.respuesta().galpones.filter((galpon) => galpon.seleccionado),
  );

  /** Reglas de muestreo de la visita (RF18–RF22). */
  readonly reglas = computed(() =>
    reglasFase2(
      this.respuesta().ficha.tipoPredio,
      this.respuesta().ficha.grupoProductivo,
    ),
  );

  /** Texto corto de las reglas, para la cabecera. */
  readonly textoReglas = computed(() => {
    const reglas = this.reglas();
    return reglas.jaula
      ? `${reglas.puntos} puntos por indicador · ${reglas.jaulasMin} a ${reglas.jaulasMax} jaulas con ${reglas.avesMin} a ${reglas.avesMax} aves por punto`
      : `${reglas.puntos} puntos por indicador · ${reglas.avesMin} a ${reglas.avesMax} aves por punto`;
  });

  /** Indicadores de la Fase II que aplican al grupo productivo (RF17). */
  readonly indicadores = computed(() =>
    indicadoresAplicables(
      this.respuesta().catalogo,
      this.respuesta().ficha.grupoProductivo,
    )
      .filter((indicador) => indicador.grupo !== 'MBG')
      .sort(
        (uno, otro) => prioridadGrupo(uno.grupo) - prioridadGrupo(otro.grupo),
      ),
  );

  /** Grupo del indicador activo: la lista de la izquierda lo sigue (wireframe). */
  readonly grupoActivo = computed<GrupoMedidas>(
    () => this.indicadorActivoObj()?.grupo ?? 'MBR',
  );

  /** Grupo activo con su avance, para la tarjeta de la izquierda (RF24). */
  readonly grupoDelActivo = computed(() => {
    const grupo = this.grupoActivo();
    const indicadores = this.indicadores().filter(
      (indicador) => indicador.grupo === grupo,
    );
    const completos = indicadores.filter((indicador) =>
      this.estaCompleto(indicador.codigo),
    ).length;
    const total = indicadores.length;
    return {
      grupo,
      etiqueta: `Indicadores ${grupo}`,
      indicadores,
      completos,
      total,
      porcentaje: total === 0 ? 0 : (completos * 100) / total,
    };
  });

  /** Indicador activo del panel central. */
  readonly indicadorActivoObj = computed(
    () =>
      this.indicadores().find(
        (indicador) => indicador.codigo === this.indicadorActivo(),
      ) ?? null,
  );

  /** Evaluación activa: lo local si existe, si no una en blanco. */
  readonly evaluacionActiva = computed<EvaluacionFase2 | null>(() => {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (galpon === null || !codigo) return null;
    return (
      this.evaluaciones().get(claveEvaluacion(galpon, codigo)) ??
      evaluacionVacia(galpon, codigo)
    );
  });

  /** Filas de puntos del indicador activo (RF18–RF21). */
  readonly puntos = computed<FilaPunto[]>(() => {
    const indicador = this.indicadorActivoObj();
    const evaluacion = this.evaluacionActiva();
    if (!indicador || !evaluacion) return [];

    const reglas = this.reglas();
    const requeridos = puntosRequeridos(indicador, reglas);
    const cantidad = requeridos.fijos
      ? reglas.puntos
      : Math.max(requeridos.minimo, maximoNumero(evaluacion.puntos));
    const total = Math.min(cantidad, MAXIMO_PUNTOS);

    return Array.from({ length: total }, (_, indice) => {
      const numero = indice + 1;
      const punto = evaluacion.puntos.find(
        (fila) => fila.numero === numero,
      ) ?? {
        numero,
        puntaje: null,
        aves: null,
        jaulas: null,
      };
      return {
        numero,
        punto,
        mensaje: mensajeMuestra(punto, reglas),
        calificable: this.puedeCalificar(punto),
      };
    });
  });

  /** Punto seleccionado: el que se está calificando (el primero si no hay). */
  readonly puntoSeleccionado = computed<FilaPunto | null>(() => {
    const filas = this.puntos();
    return (
      filas.find((fila) => fila.numero === this.puntoActivo()) ??
      filas[0] ??
      null
    );
  });

  /** Cálculo en vivo del indicador activo (RF34). */
  readonly calculo = computed(() => {
    const evaluacion = this.evaluacionActiva();
    const indicador = this.indicadorActivoObj();
    if (!evaluacion || !indicador) return null;

    const reglas = this.reglas();
    const requeridos = puntosRequeridos(indicador, reglas);
    const promedio = evaluacion.noAplica
      ? null
      : promedioPuntos(evaluacion.puntos);
    const registrados = puntajesDe(evaluacion.puntos).length;
    const total = requeridos.fijos
      ? reglas.puntos
      : Math.max(requeridos.minimo, registrados);

    return {
      noAplica: evaluacion.noAplica,
      completo: indicadorCompleto(evaluacion, indicador, reglas),
      // Los puntajes registrados, en el orden de los puntos (RF24).
      puntajes: Array.from(
        { length: total },
        (_, indice) =>
          evaluacion.puntos.find((fila) => fila.numero === indice + 1)
            ?.puntaje ?? null,
      ),
      promedio,
      valor: valorIndicador(promedio),
      registrados,
      faltan: Math.max(0, requeridos.minimo - registrados),
      minimo: requeridos.minimo,
    };
  });

  /** Avance del galpón activo, por grupo de medidas (RF24). */
  readonly avance = computed(() => {
    const galpon = this.galponActivo();
    if (galpon === null) return null;
    return (
      avanceDe(
        [galpon],
        this.indicadores(),
        [...this.evaluaciones().values()],
        this.reglas(),
      )[0] ?? null
    );
  });

  /** Texto del avance del galpón, con el grupo activo primero (wireframe). */
  readonly textoAvance = computed(() => {
    const avance = this.avance();
    if (!avance) return '';
    const activo = this.grupoActivo();
    const grupos = [
      ...avance.grupos.filter((grupo) => grupo.grupo === activo),
      ...avance.grupos.filter((grupo) => grupo.grupo !== activo),
    ];
    return grupos
      .map((grupo) => `${grupo.grupo} ${grupo.completos}/${grupo.total}`)
      .join(' · ');
  });

  /** Fotos del indicador activo (RF23). */
  readonly evidencias = computed(() => {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    return this.respuesta().fase2.evidencias.filter(
      (evidencia) =>
        evidencia.galponNumero === galpon &&
        evidencia.indicadorCodigo === codigo,
    );
  });

  /** Fecha y hora del último guardado del indicador (RF26). */
  readonly guardadoActivo = computed(() => {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (galpon === null || !codigo) return null;
    return (
      this.respuesta().fase2.evaluaciones.find(
        (evaluacion) =>
          evaluacion.galponNumero === galpon &&
          evaluacion.indicadorCodigo === codigo,
      )?.guardadoEn ?? null
    );
  });

  constructor() {
    effect(
      () => {
        const respuesta = this.respuesta();
        if (respuesta.visita.id === this.visitaSembrada) return;
        this.visitaSembrada = respuesta.visita.id;
        this.sembrar(respuesta);
      },
      { allowSignalWrites: true },
    );
  }

  // -------------------------------------------------------------- consultas

  /** ¿El indicador está completo en el galpón activo? (RF24) */
  estaCompleto(codigo: string): boolean {
    const galpon = this.galponActivo();
    const indicador = this.indicadores().find((fila) => fila.codigo === codigo);
    if (galpon === null || !indicador) return false;
    return indicadorCompleto(
      this.evaluaciones().get(claveEvaluacion(galpon, codigo)),
      indicador,
      this.reglas(),
    );
  }

  /** Descripción del puntaje que trae el catálogo (RF19), si existe. */
  descripcionPuntaje(indicador: IndicadorCatalogo, puntaje: number): string {
    return indicador.escalaDescripciones?.[puntaje] ?? `Puntaje ${puntaje}`;
  }

  /**
   * Método del indicador para la píldora del encabezado (wireframe). Mientras
   * el catálogo no traiga el método (provisional), se deduce del muestreo.
   */
  etiquetaMetodo(indicador: IndicadorCatalogo): string {
    if (indicador.metodo) return indicador.metodo;
    return indicador.tipoMuestreo === 'HOJAS_CENTINELA'
      ? 'muestreo con hojas centinela'
      : 'visual con muestreo';
  }

  /** Clases del círculo de un punto, según su estado (wireframe). */
  clasePunto(fila: FilaPunto): string {
    if (this.puntoSeleccionado()?.numero === fila.numero) {
      return 'bg-marca text-marca-contraste';
    }
    return fila.punto.puntaje === null
      ? 'border border-borde bg-superficie text-contenido hover:bg-superficie-alterna'
      : 'bg-acento text-acento-contraste hover:bg-acento-fuerte';
  }

  /** ¿El valor es el puntaje del punto seleccionado? (RF19) */
  esPuntajeSeleccionado(valor: number): boolean {
    return this.puntoSeleccionado()?.punto.puntaje === valor;
  }

  /** Clases de una tarjeta de puntaje, según lo calificado (wireframe). */
  clasePuntaje(valor: number): string {
    return this.esPuntajeSeleccionado(valor)
      ? 'bg-marca text-marca-contraste'
      : 'bg-superficie-alterna text-contenido hover:bg-marca-tenue';
  }

  /** ¿Se puede calificar el punto? En jaula, primero el conteo (RF21). */
  private puedeCalificar(punto: PuntoEvaluado): boolean {
    const reglas = this.reglas();
    if (!reglas.jaula) return true;
    return (
      enRango(punto.jaulas, reglas.jaulasMin, reglas.jaulasMax) &&
      enRango(punto.aves, reglas.avesMin, reglas.avesMax)
    );
  }

  hayAnterior(): boolean {
    return this.indiceActivo() > 0;
  }

  haySiguiente(): boolean {
    return this.indiceActivo() < this.indicadores().length - 1;
  }

  private indiceActivo(): number {
    return this.indicadores().findIndex(
      (indicador) => indicador.codigo === this.indicadorActivo(),
    );
  }

  // --------------------------------------------------------------- acciones

  /** Cambia de galpón (RF16). */
  elegirGalpon(numero: number): void {
    this.error.set(null);
    this.aviso.set(null);
    this.galponActivo.set(numero);
    this.reiniciarPuntoActivo();
  }

  /** Abre un indicador en el panel central (RF17). */
  abrirIndicador(codigo: string): void {
    this.error.set(null);
    this.aviso.set(null);
    this.indicadorActivo.set(codigo);
    this.reiniciarPuntoActivo();
  }

  /** Selecciona el punto de muestreo que se está calificando (RF18). */
  seleccionarPunto(numero: number): void {
    this.error.set(null);
    this.puntoActivo.set(numero);
  }

  /** Califica el punto seleccionado; repetir el mismo valor lo borra (RF19). */
  calificar(valor: number): void {
    const fila = this.puntoSeleccionado();
    if (!fila?.calificable) return;
    this.editarPunto(fila.numero, (punto) => ({
      ...punto,
      puntaje: punto.puntaje === valor ? null : valor,
    }));
  }

  /** Registra las aves evaluadas en el punto seleccionado (RF20). */
  cambiarAves(evento: Event): void {
    const fila = this.puntoSeleccionado();
    if (!fila) return;
    const valor = leerEntero(evento);
    this.editarPunto(fila.numero, (punto) => ({ ...punto, aves: valor }));
  }

  /** Registra las jaulas muestreadas en el punto seleccionado (RF20, RF21). */
  cambiarJaulas(evento: Event): void {
    const fila = this.puntoSeleccionado();
    if (!fila) return;
    const valor = leerEntero(evento);
    this.editarPunto(fila.numero, (punto) => ({ ...punto, jaulas: valor }));
  }

  /** Agrega una hoja centinela más y la deja seleccionada (RF22). */
  agregarHoja(): void {
    const evaluacion = this.evaluacionActiva();
    const indicador = this.indicadorActivoObj();
    if (!evaluacion || !indicador) return;
    const requeridos = puntosRequeridos(indicador, this.reglas());
    const visibles = Math.max(
      requeridos.minimo,
      maximoNumero(evaluacion.puntos),
    );
    if (visibles >= MAXIMO_PUNTOS) return;
    this.editarPunto(visibles + 1, (punto) => punto);
    this.puntoActivo.set(visibles + 1);
  }

  /** Marca «No aplica» con su motivo; excluye el indicador (RF25). */
  cambiarNoAplica(noAplica: boolean): void {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (galpon === null || !codigo) return;
    const clave = claveEvaluacion(galpon, codigo);
    const mapa = new Map(this.evaluaciones());
    const actual = mapa.get(clave) ?? evaluacionVacia(galpon, codigo);
    mapa.set(clave, {
      ...actual,
      noAplica,
      // Un indicador «No aplica» no lleva puntos (RF25).
      puntos: noAplica ? [] : actual.puntos,
    });
    this.evaluaciones.set(mapa);
  }

  /** Escribe el motivo del «No aplica» (RF25). */
  cambiarMotivo(evento: Event): void {
    this.editarActiva((evaluacion) => ({
      ...evaluacion,
      motivoNoAplica: leerTexto(evento),
    }));
  }

  /** Escribe la observación del indicador (RF23). */
  cambiarObservaciones(evento: Event): void {
    this.editarActiva((evaluacion) => ({
      ...evaluacion,
      observaciones: leerTexto(evento),
    }));
  }

  anterior(): void {
    this.mover(-1);
  }

  siguiente(): void {
    this.mover(1);
  }

  /** Guarda el borrador de la fase tal como va (RF26). */
  guardarBorrador(): void {
    this.enviar(false);
  }

  /** Guarda el borrador y pasa al siguiente indicador. */
  guardarYSiguiente(): void {
    this.enviar(true);
  }

  // -------------------------------------------------------------- evidencias

  /** Adjunta una foto al indicador activo (RF23). */
  async adjuntarFoto(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (!archivo || galpon === null || !codigo) return;

    this.error.set(null);
    this.aviso.set(null);
    if (!TIPOS_FOTO.includes(archivo.type)) {
      this.error.set('Solo se admiten fotos JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_FOTO) {
      this.error.set('La foto no puede pesar más de 8 MB.');
      return;
    }
    if (!this.sincronizacion.enLinea()) {
      this.error.set('Sin conexión: las fotos se suben cuando vuelva la red.');
      return;
    }

    this.subiendo.set(true);
    try {
      const subida = await firstValueFrom(
        this.inspeccion.crearEvidencia(this.respuesta().visita.id, {
          galponNumero: galpon,
          indicadorCodigo: codigo,
          nombre: archivo.name,
          tipo: archivo.type,
          tamano: archivo.size,
          hash: await huella(archivo),
        }),
      );
      await firstValueFrom(
        this.inspeccion.subirArchivo(subida.urlSubida, archivo),
      );
      await firstValueFrom(
        this.inspeccion.confirmarEvidencia(subida.evidencia.id),
      );
      this.aviso.set('Foto adjuntada.');
      this.refrescar.emit();
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    } finally {
      this.subiendo.set(false);
    }
  }

  /** Abre la foto con una URL firmada de vida corta (RNF22). */
  async verFoto(evidencia: Evidencia): Promise<void> {
    this.error.set(null);
    try {
      const { url } = await firstValueFrom(
        this.inspeccion.urlEvidencia(evidencia.id),
      );
      window.open(url, '_blank', 'noopener');
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    }
  }

  /** Borra una foto (RF23). */
  async quitarFoto(evidencia: Evidencia): Promise<void> {
    this.error.set(null);
    this.aviso.set(null);
    try {
      await firstValueFrom(this.inspeccion.eliminarEvidencia(evidencia.id));
      this.aviso.set('Foto borrada.');
      this.refrescar.emit();
    } catch (fallo) {
      this.error.set(mensajeDeError(fallo));
    }
  }

  // --------------------------------------------------------------- internos

  /** Siembra el estado local con lo que hay guardado (una vez por visita). */
  private sembrar(respuesta: InspeccionRespuesta): void {
    const mapa = new Map<string, EvaluacionFase2>();
    for (const evaluacion of respuesta.fase2.evaluaciones) {
      mapa.set(
        claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
        {
          galponNumero: evaluacion.galponNumero,
          indicadorCodigo: evaluacion.indicadorCodigo,
          noAplica: evaluacion.noAplica,
          motivoNoAplica: evaluacion.motivoNoAplica,
          observaciones: evaluacion.observaciones,
          puntos: evaluacion.puntos.map((punto) => ({ ...punto })),
          guardadoEn: evaluacion.guardadoEn ?? '',
        },
      );
    }
    this.evaluaciones.set(mapa);

    const seleccionados = respuesta.galpones.filter(
      (galpon) => galpon.seleccionado,
    );
    if (
      !seleccionados.some((galpon) => galpon.numero === this.galponActivo())
    ) {
      this.galponActivo.set(seleccionados[0]?.numero ?? null);
    }

    const indicadores = this.indicadores();
    if (
      !indicadores.some(
        (indicador) => indicador.codigo === this.indicadorActivo(),
      )
    ) {
      this.indicadorActivo.set(indicadores[0]?.codigo ?? null);
    }

    this.reiniciarPuntoActivo();
  }

  /**
   * Deja seleccionado el primer punto sin calificar del indicador activo; si
   * ya están todos, el primero (RF18).
   */
  private reiniciarPuntoActivo(): void {
    const filas = this.puntos();
    const pendiente = filas.find((fila) => fila.punto.puntaje === null);
    this.puntoActivo.set((pendiente ?? filas[0])?.numero ?? null);
  }

  /** Edita un punto de la evaluación activa. */
  private editarPunto(
    numero: number,
    cambio: (punto: PuntoEvaluado) => PuntoEvaluado,
  ): void {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (galpon === null || !codigo) return;

    const clave = claveEvaluacion(galpon, codigo);
    const mapa = new Map(this.evaluaciones());
    const actual = mapa.get(clave) ?? evaluacionVacia(galpon, codigo);
    const existente = actual.puntos.find(
      (punto) => punto.numero === numero,
    ) ?? { numero, puntaje: null, aves: null, jaulas: null };
    const puntos = [
      ...actual.puntos.filter((punto) => punto.numero !== numero),
      cambio(existente),
    ].sort((uno, otro) => uno.numero - otro.numero);

    mapa.set(clave, { ...actual, puntos });
    this.evaluaciones.set(mapa);
  }

  /** Edita la evaluación activa completa (motivo, observaciones). */
  private editarActiva(
    cambio: (evaluacion: EvaluacionFase2) => EvaluacionFase2,
  ): void {
    const galpon = this.galponActivo();
    const codigo = this.indicadorActivo();
    if (galpon === null || !codigo) return;

    const clave = claveEvaluacion(galpon, codigo);
    const mapa = new Map(this.evaluaciones());
    const actual = mapa.get(clave) ?? evaluacionVacia(galpon, codigo);
    mapa.set(clave, cambio(actual));
    this.evaluaciones.set(mapa);
  }

  /** Navega entre los indicadores del grupo productivo. */
  private mover(paso: number): void {
    const indicadores = this.indicadores();
    const indice = this.indiceActivo();
    if (indice < 0) return;
    const destino = indice + paso;
    if (destino < 0 || destino >= indicadores.length) return;
    this.abrirIndicador(indicadores[destino].codigo);
  }

  /**
   * Valida lo diligenciado y entrega las evaluaciones a la página para
   * guardarlas (RF26). Si algo está mal, lleva al indicador del problema.
   */
  private enviar(siguiente: boolean): void {
    this.error.set(null);
    this.aviso.set(null);

    const indicadores = this.indicadores();
    const reglas = this.reglas();
    for (const evaluacion of this.evaluacionesConDatos()) {
      const indicador = indicadores.find(
        (fila) => fila.codigo === evaluacion.indicadorCodigo,
      );
      if (!indicador) continue;
      const errores = erroresDeEvaluacion(evaluacion, indicador, reglas);
      if (errores.length > 0) {
        this.galponActivo.set(evaluacion.galponNumero);
        this.indicadorActivo.set(evaluacion.indicadorCodigo);
        this.error.set(errores[0]);
        this.seleccionarPuntoDelError(errores[0]);
        return;
      }
    }

    this.guardar.emit(this.evaluacionesConDatos());
    if (siguiente && this.haySiguiente()) this.siguiente();
  }

  /** Selecciona el punto al que se refiere un error de validación, si lo dice. */
  private seleccionarPuntoDelError(mensaje: string): void {
    const coincidencia = /, punto (\d+):/.exec(mensaje);
    if (coincidencia) this.puntoActivo.set(Number(coincidencia[1]));
    else this.reiniciarPuntoActivo();
  }

  /** Evaluaciones locales con algo que guardar (puntos, «No aplica» u observaciones). */
  private evaluacionesConDatos(): EvaluacionFase2[] {
    return [...this.evaluaciones().values()].filter(
      (evaluacion) =>
        evaluacion.puntos.length > 0 ||
        evaluacion.noAplica ||
        (evaluacion.observaciones ?? '').trim().length > 0,
    );
  }
}

/** Posición del grupo en la fase: MBR primero, luego MBA (wireframe). */
function prioridadGrupo(grupo: GrupoMedidas): number {
  const indice = ORDEN_GRUPOS.indexOf(grupo);
  return indice === -1 ? ORDEN_GRUPOS.length : indice;
}

/** Número más alto entre los puntos registrados (0 si no hay ninguno). */
function maximoNumero(puntos: readonly PuntoEvaluado[]): number {
  return puntos.reduce((mayor, punto) => Math.max(mayor, punto.numero), 0);
}

/** Lee un entero del campo; vacío o inválido queda en nulo. */
function leerEntero(evento: Event): number | null {
  const texto = (evento.target as HTMLInputElement).value.trim();
  if (texto === '') return null;
  const valor = Number(texto);
  return Number.isInteger(valor) ? valor : null;
}

/** Lee el texto de un campo; vacío queda en nulo. */
function leerTexto(evento: Event): string | null {
  const texto = (evento.target as HTMLInputElement).value;
  return texto.trim() === '' ? null : texto;
}

/** Huella SHA-256 del archivo; si el equipo no puede calcularla, va sin ella. */
async function huella(archivo: File): Promise<string | undefined> {
  try {
    const resumen = await crypto.subtle.digest(
      'SHA-256',
      await archivo.arrayBuffer(),
    );
    return [...new Uint8Array(resumen)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
}
