import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  PUNTAJE_MAX,
  PUNTAJE_MIN,
  avanceFase3,
  documentoVacio,
  erroresDeDocumento,
  esMortalidad,
  mensajeMortalidad,
  reglasFase3,
  type DocumentoEvaluado,
} from '../../core/inspeccion/fase3.modelos';
import {
  puntajePorRangos,
  rangosDe,
} from '../../core/inspeccion/calculo.modelos';
import {
  indicadoresAplicables,
  type IndicadorCatalogo,
  type InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';
import { EstadoVacioComponent } from '../../shared/ui/estado-vacio/estado-vacio.component';
import { TarjetaComponent } from '../../shared/ui/tarjeta/tarjeta.component';

/** Clases de la insignia de un puntaje, como en el wireframe. */
const INSIGNIA_PUNTAJE: Record<number, string> = {
  2: 'bg-acento text-acento-contraste',
  1: 'bg-acento-fuerte text-acento-contraste',
  0: 'bg-peligro text-peligro-contraste',
};

/** Una fila de la lista de documentos (RF27). */
interface FilaDocumento {
  indicador: IndicadorCatalogo;
  documento: DocumentoEvaluado | null;
  /** Insignia de estado: «Revisando», «Pendiente», «N pts» o «Sin ver». */
  insignia: { texto: string; clase: string };
}

/**
 * Inspección documental, Fase III (M5 · RF27–RF33).
 *
 * Reproduce el panel del wireframe: a la izquierda la lista de documentos de
 * gestión (MBG) con su avance; en el centro el documento activo, con la
 * pregunta de si se presentó, la lista de chequeo del documento (RF28), la
 * calificación 0/1/2 (RF19) —o la tasa de mortalidad, que se califica por
 * rangos (RF30)—, la marca de pendiente (RF31) y la regla del 0 (RF29). En
 * traspatio la fase no existe (RF33).
 *
 * Todo se diligencia primero en el equipo (RF12): la pantalla mantiene las
 * verificaciones locales y las entrega a la página, que las guarda por la cola
 * de sincronización.
 */
@Component({
  selector: 'app-fase3-documental',
  standalone: true,
  imports: [
    DatePipe,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    AvisoComponent,
    EstadoVacioComponent,
    TarjetaComponent,
  ],
  templateUrl: './fase3-documental.component.html',
})
export class Fase3DocumentalComponent {
  /** Respuesta completa de la inspección (la trae la página). */
  readonly respuesta = input.required<InspeccionRespuesta>();
  /** Verdadero mientras la página está guardando. */
  readonly guardando = input(false);
  /** Pide guardar las verificaciones de la Fase III (RF26). */
  readonly guardar = output<DocumentoEvaluado[]>();

  /** Valores de la escala, en el orden del wireframe: 2, 1 y 0 (RF19). */
  readonly puntajes = [PUNTAJE_MAX, PUNTAJE_MAX - 1, PUNTAJE_MIN];

  readonly documentoActivo = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  /** Texto tal cual del campo de mortalidad, para no romper la coma decimal. */
  readonly textoMortalidad = signal('');

  /** Verificaciones que se están diligenciando en este equipo (RF12). */
  private readonly documentos = signal<Map<string, DocumentoEvaluado>>(
    new Map(),
  );
  private visitaSembrada = '';

  /** Reglas de la fase documental de la visita (RF30, RF33). */
  readonly reglas = computed(() =>
    reglasFase3(
      this.respuesta().ficha.tipoPredio,
      this.respuesta().ficha.grupoProductivo,
    ),
  );

  /** Documentos de gestión (MBG) que aplican al grupo productivo (RF17). */
  readonly indicadores = computed(() =>
    indicadoresAplicables(
      this.respuesta().catalogo,
      this.respuesta().ficha.grupoProductivo,
    ).filter((indicador) => indicador.grupo === 'MBG'),
  );

  /** Documento activo del panel central. */
  readonly documentoActivoObj = computed(
    () =>
      this.indicadores().find(
        (indicador) => indicador.codigo === this.documentoActivo(),
      ) ?? null,
  );

  /** Verificación activa: lo local si existe, si no una en blanco. */
  readonly documentoActivoEvaluado = computed<DocumentoEvaluado | null>(() => {
    const codigo = this.documentoActivo();
    if (!codigo) return null;
    return this.documentos().get(codigo) ?? documentoVacio(codigo);
  });

  /** Avance local: verificados sobre el total (RF24, RF31). */
  readonly avance = computed(() =>
    avanceFase3([...this.documentos().values()], this.indicadores()),
  );

  /** Porcentaje del avance, para la barra de la lista (wireframe). */
  readonly porcentaje = computed(() => {
    const { verificados, total } = this.avance();
    return total === 0 ? 0 : (verificados * 100) / total;
  });

  /** Filas de la lista de documentos, con su insignia (RF27). */
  readonly filas = computed<FilaDocumento[]>(() =>
    this.indicadores().map((indicador) => {
      const documento = this.documentos().get(indicador.codigo) ?? null;
      return {
        indicador,
        documento,
        insignia: this.insigniaDe(indicador.codigo, documento),
      };
    }),
  );

  /** Fecha y hora del último guardado del documento (RF26). */
  readonly guardadoActivo = computed(() => {
    const codigo = this.documentoActivo();
    if (!codigo) return null;
    return (
      this.respuesta().fase3.documentos.find(
        (documento) => documento.indicadorCodigo === codigo,
      )?.guardadoEn ?? null
    );
  });

  /** Problema de la tasa de mortalidad a medio escribir (RF30). */
  readonly mensajeTasa = computed<string | null>(() => {
    const texto = this.textoMortalidad().trim();
    if (texto === '') return null;
    const documento = this.documentoActivoEvaluado();
    if (!documento || documento.mortalidad === null) {
      return 'La tasa de mortalidad debe ser un número (ejemplo: 7,5).';
    }
    return mensajeMortalidad(documento);
  });

  /** Resultado de la mortalidad, para la tarjeta del cálculo (RF30). */
  readonly resultadoMortalidad = computed(() => {
    const documento = this.documentoActivoEvaluado();
    const indicador = this.documentoActivoObj();
    if (!documento || !indicador || documento.puntaje === null) return null;
    return {
      puntaje: documento.puntaje,
      descripcion: this.descripcionPuntaje(indicador, documento.puntaje),
    };
  });

  /** Rangos de mortalidad que se muestran bajo el campo (RF30, RF38). */
  readonly textoRangos = computed(() => {
    const indicador = this.documentoActivoObj();
    const rangos = indicador
      ? rangosDe(indicador, this.respuesta().ficha.grupoProductivo)
      : null;
    if (!rangos) {
      return 'Los rangos de mortalidad salen del catálogo, según el grupo productivo elegido en la Fase I (RF30).';
    }
    const grupo =
      this.respuesta().ficha.etiquetaGrupoProductivo ?? 'el grupo productivo';
    const partes = rangos.map((rango, indice) => {
      const anterior = rangos[indice - 1]?.max;
      const unidad = rango.puntaje === 1 ? 'pt' : 'pts';
      return rango.max === null
        ? `más de ${anterior} % → ${rango.puntaje} ${unidad}`
        : `hasta ${rango.max} % → ${rango.puntaje} ${unidad}`;
    });
    return `${grupo}: ${partes.join(' · ')} (RF30).`;
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

  /** ¿El documento se califica por rangos de mortalidad? (RF30) */
  esMortalidad(indicador: IndicadorCatalogo): boolean {
    return esMortalidad(indicador);
  }

  /** Descripción del puntaje que trae el catálogo (RF19), si existe. */
  descripcionPuntaje(indicador: IndicadorCatalogo, puntaje: number): string {
    return indicador.escalaDescripciones?.[puntaje] ?? `Puntaje ${puntaje}`;
  }

  /** ¿El valor es el puntaje del documento activo? (RF19) */
  esPuntajeSeleccionado(valor: number): boolean {
    return this.documentoActivoEvaluado()?.puntaje === valor;
  }

  /** Clases de una tarjeta de puntaje, según lo calificado (wireframe). */
  clasePuntaje(valor: number): string {
    return this.esPuntajeSeleccionado(valor)
      ? 'bg-marca text-marca-contraste'
      : 'bg-superficie-alterna text-contenido hover:bg-marca-tenue';
  }

  // --------------------------------------------------------------- acciones

  /** Abre un documento en el panel central (RF27). */
  abrirDocumento(codigo: string): void {
    this.error.set(null);
    this.documentoActivo.set(codigo);
    this.textoMortalidad.set(this.textoDe(this.documentos().get(codigo)));
  }

  /** ¿Se presentó el documento? (RF27) */
  marcarPresentado(presentado: boolean): void {
    this.error.set(null);
    this.editarActiva((documento) => {
      const veniaDeNo = documento.presentado === false;
      return {
        ...documento,
        presentado,
        // Sin documento el puntaje es 0 (RF29); al volver a «Sí» se recalifica.
        puntaje: presentado ? (veniaDeNo ? null : documento.puntaje) : 0,
        // El chequeo del documento solo cuenta si se presentó (RF28).
        legible: presentado ? documento.legible : false,
        firmadoResponsable: presentado ? documento.firmadoResponsable : false,
        firmadoProfesional: presentado ? documento.firmadoProfesional : null,
      };
    });
  }

  /** Marca o desmarca «legible y sin correcciones» (RF28). */
  alternarLegible(): void {
    this.editarActiva((documento) => ({
      ...documento,
      legible: !documento.legible,
    }));
  }

  /** Marca o desmarca la firma del responsable (RF28). */
  alternarFirmadoResponsable(): void {
    this.editarActiva((documento) => ({
      ...documento,
      firmadoResponsable: !documento.firmadoResponsable,
    }));
  }

  /** Marca o desmarca la firma de MV/MVZ con matrícula vigente (RF28). */
  alternarFirmadoProfesional(): void {
    this.editarActiva((documento) => ({
      ...documento,
      firmadoProfesional: !documento.firmadoProfesional,
    }));
  }

  /** Califica el documento; repetir el mismo valor lo borra (RF19). */
  calificar(valor: number): void {
    this.editarActiva((documento) => ({
      ...documento,
      puntaje: documento.puntaje === valor ? null : valor,
    }));
  }

  /** Escribe la tasa de mortalidad y recalcula su puntaje (RF30, RF38). */
  cambiarMortalidad(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.textoMortalidad.set(texto);
    const tasa = leerDecimal(texto);
    const indicador = this.documentoActivoObj();
    const rangos = indicador
      ? rangosDe(indicador, this.respuesta().ficha.grupoProductivo)
      : null;
    this.editarActiva((documento) => ({
      ...documento,
      mortalidad: tasa,
      puntaje:
        documento.presentado === true
          ? tasa === null || !rangos
            ? null
            : puntajePorRangos(tasa, rangos)
          : documento.puntaje,
    }));
  }

  /** Marca o desmarca el documento para entregarlo dentro del plazo (RF31). */
  alternarPendiente(): void {
    this.error.set(null);
    this.editarActiva((documento) => ({
      ...documento,
      pendiente: !documento.pendiente,
    }));
  }

  /** Guarda el borrador de la fase tal como va (RF26). */
  guardarBorrador(): void {
    this.enviar(false);
  }

  /** Guarda el borrador y pasa al siguiente documento. */
  siguiente(): void {
    this.enviar(true);
  }

  // --------------------------------------------------------------- internos

  /** Siembra el estado local con lo que hay guardado (una vez por visita). */
  private sembrar(respuesta: InspeccionRespuesta): void {
    const mapa = new Map<string, DocumentoEvaluado>();
    for (const documento of respuesta.fase3.documentos) {
      mapa.set(documento.indicadorCodigo, {
        indicadorCodigo: documento.indicadorCodigo,
        presentado: documento.presentado,
        legible: documento.legible,
        firmadoResponsable: documento.firmadoResponsable,
        firmadoProfesional: documento.firmadoProfesional,
        mortalidad: documento.mortalidad,
        puntaje: documento.puntaje,
        pendiente: documento.pendiente,
        guardadoEn: documento.guardadoEn ?? '',
      });
    }
    this.documentos.set(mapa);

    const indicadores = this.indicadores();
    if (
      !indicadores.some(
        (indicador) => indicador.codigo === this.documentoActivo(),
      )
    ) {
      this.documentoActivo.set(indicadores[0]?.codigo ?? null);
    }
    this.textoMortalidad.set(
      this.textoDe(this.documentos().get(this.documentoActivo() ?? '')),
    );
  }

  /** Edita la verificación del documento activo. */
  private editarActiva(
    cambio: (documento: DocumentoEvaluado) => DocumentoEvaluado,
  ): void {
    const codigo = this.documentoActivo();
    if (!codigo) return;
    const mapa = new Map(this.documentos());
    const actual = mapa.get(codigo) ?? documentoVacio(codigo);
    mapa.set(codigo, cambio(actual));
    this.documentos.set(mapa);
  }

  /** Índice del documento activo en la lista. */
  private indiceActivo(): number {
    return this.indicadores().findIndex(
      (indicador) => indicador.codigo === this.documentoActivo(),
    );
  }

  /** Navega entre los documentos de gestión. */
  private mover(paso: number): void {
    const indicadores = this.indicadores();
    const indice = this.indiceActivo();
    if (indice < 0) return;
    const destino = indice + paso;
    if (destino < 0 || destino >= indicadores.length) return;
    this.abrirDocumento(indicadores[destino].codigo);
  }

  /**
   * Valida lo diligenciado y entrega las verificaciones a la página para
   * guardarlas (RF26). Si algo está mal, lleva al documento del problema.
   */
  private enviar(siguiente: boolean): void {
    this.error.set(null);

    // Una tasa a medio escribir no se guarda (RF30): se avisa y se detiene.
    const mensaje = this.mensajeTasa();
    if (mensaje && this.documentoActivoEvaluado()?.mortalidad === null) {
      this.error.set(mensaje);
      return;
    }

    const indicadores = this.indicadores();
    const grupo = this.respuesta().ficha.grupoProductivo;
    for (const documento of this.documentosConDatos()) {
      const indicador = indicadores.find(
        (fila) => fila.codigo === documento.indicadorCodigo,
      );
      if (!indicador) continue;
      const errores = erroresDeDocumento(documento, indicador, grupo);
      if (errores.length > 0) {
        this.documentoActivo.set(documento.indicadorCodigo);
        this.textoMortalidad.set(this.textoDe(documento));
        this.error.set(errores[0]);
        return;
      }
    }

    this.guardar.emit(this.documentosConDatos());
    if (siguiente) this.mover(1);
  }

  /** Verificaciones locales con algo que guardar (presentado o pendiente). */
  private documentosConDatos(): DocumentoEvaluado[] {
    return [...this.documentos().values()].filter(
      (documento) => documento.presentado !== null || documento.pendiente,
    );
  }

  /** Texto del campo de mortalidad: el número con coma decimal. */
  private textoDe(documento: DocumentoEvaluado | null | undefined): string {
    const tasa = documento?.mortalidad ?? null;
    return tasa === null ? '' : String(tasa).replace('.', ',');
  }

  /** Insignia de la lista, como la muestra el wireframe. */
  private insigniaDe(
    codigo: string,
    documento: DocumentoEvaluado | null,
  ): { texto: string; clase: string } {
    if (this.documentoActivo() === codigo) {
      return { texto: 'Revisando', clase: 'bg-acento text-acento-contraste' };
    }
    if (documento?.pendiente) {
      return {
        texto: 'Pendiente',
        clase: 'bg-advertencia text-advertencia-contraste',
      };
    }
    if (documento && documento.puntaje !== null) {
      const puntaje = documento.puntaje;
      return {
        texto: `${puntaje} pt${puntaje === 1 ? '' : 's'}`,
        clase: INSIGNIA_PUNTAJE[puntaje] ?? INSIGNIA_PUNTAJE[0],
      };
    }
    return {
      texto: 'Sin ver',
      clase: 'bg-contenido-deshabilitado text-marca-contraste',
    };
  }
}

/** Lee un decimal del campo (admite coma o punto); vacío o inválido, nulo. */
function leerDecimal(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}
