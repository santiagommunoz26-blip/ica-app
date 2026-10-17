import { ApiProperty } from '@nestjs/swagger';
import type { Indicador } from '../../metodologia/entities/indicador.entity.js';
import {
  ETIQUETA_GRUPO_MEDIDAS,
  GrupoMedidas,
} from '../../metodologia/metodologia.tipos.js';
import {
  Clasificacion,
  EstadoVisita,
  ETIQUETA_CLASIFICACION,
  esEditable,
} from '../../visitas/visitas.tipos.js';
import type { CalculoVisita } from '../calculo.tipos.js';
import {
  ETIQUETA_PRIORIDAD,
  prioridadDeMejora,
  type PrioridadMejora,
} from '../cierre.reglas.js';
import type { Acta } from '../entities/acta.entity.js';
import type { DocumentoEvaluado } from '../fase3.tipos.js';

/**
 * Cierre de la visita · Fase IV (M7 · RF39–RF45) tal como lo ve la interfaz:
 * el resultado del cierre (los pendientes cuentan como 0, RF29/RF43), los
 * indicadores por prioridad de mejora (RF40), el plazo de documentos (RF43) y
 * el acta vigente con su firma (RF41–RF45).
 */

/** Indicador evaluado con su prioridad de mejora (RF39, RF40). */
export class IndicadorMejoraRespuestaDto {
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty() etiquetaGrupo: string;
  @ApiProperty({ nullable: true, description: 'Valor en % (0–100).' })
  valor: number | null;
  @ApiProperty({ description: 'Documento pendiente de entrega (RF31).' })
  pendiente: boolean;
  @ApiProperty({
    enum: ['ALTA', 'MEDIA', 'SIN_PRIORIDAD'],
    nullable: true,
    description: 'Prioridad de mejora (RF40); nula sin valor.',
  })
  prioridad: PrioridadMejora | null;
  @ApiProperty({ nullable: true }) etiquetaPrioridad: string | null;
}

/** Acta vigente de la visita, con lo que la interfaz muestra (RF41–RF45). */
export class ActaResumenRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty() version: number;
  @ApiProperty({
    description: 'Definitiva: no se modifica ni se reemplaza (RNF10).',
  })
  definitiva: boolean;
  @ApiProperty() firmadaEn: string;
  @ApiProperty() firmadaPorNombre: string;
  @ApiProperty() documentosPendientes: number;
  @ApiProperty({ nullable: true }) vencimientoDocumentos: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Calificación congelada al firmar (RF39).',
  })
  calificacion: number | null;
  @ApiProperty({
    enum: Clasificacion,
    enumName: 'Clasificacion',
    nullable: true,
  })
  clasificacion: Clasificacion | null;
  @ApiProperty({ nullable: true }) etiquetaClasificacion: string | null;
  @ApiProperty({ nullable: true }) correoEnviadoEn: string | null;
  @ApiProperty({ nullable: true }) correoDestinatario: string | null;
  @ApiProperty({ description: 'Tamaño del PDF en bytes.' })
  tamano: number;
  @ApiProperty({ description: 'Huella SHA-256 del PDF (RNF10).' })
  huella: string;
}

/** Cierre de la visita · Fase IV (M7 · RF39–RF45). */
export class Fase4RespuestaDto {
  @ApiProperty({
    description:
      'Todos los indicadores quedaron con valor o «No aplica»; los documentos pendientes cuentan como 0 (RF29/RF43).',
  })
  completo: boolean;

  @ApiProperty({
    description: 'Indicadores sin evaluar todavía; bloquean la firma.',
  })
  indicadoresSinEvaluar: number;

  @ApiProperty({
    type: () => IndicadorMejoraRespuestaDto,
    isArray: true,
    description:
      'Indicadores evaluados, ordenados por prioridad de mejora (RF40).',
  })
  indicadores: IndicadorMejoraRespuestaDto[];

  /** Resultado del cierre: los pendientes cuentan como 0 provisionalmente. */
  @ApiProperty({
    nullable: true,
    description: 'Calificación del cierre en % (RF39).',
  })
  final: number | null;

  @ApiProperty({
    enum: Clasificacion,
    enumName: 'Clasificacion',
    nullable: true,
  })
  clasificacion: Clasificacion | null;

  @ApiProperty({ nullable: true }) etiquetaClasificacion: string | null;

  @ApiProperty({
    description: 'Aportes por grupo de medidas del cierre (RF39).',
  })
  grupos: {
    grupo: GrupoMedidas;
    etiqueta: string;
    peso: number;
    promedio: number | null;
    aporte: number | null;
  }[];

  @ApiProperty({ description: 'Documentos pendientes de entrega (RF31).' })
  documentosPendientes: number;

  @ApiProperty({
    nullable: true,
    description: 'Fecha y hora de vencimiento del plazo (RF43).',
  })
  vencimiento: string | null;

  @ApiProperty({ description: 'El plazo de documentos ya venció (RF44).' })
  vencido: boolean;

  @ApiProperty({ type: () => ActaResumenRespuestaDto, nullable: true })
  acta: ActaResumenRespuestaDto | null;

  @ApiProperty({ description: 'Se puede firmar y emitir la siguiente acta.' })
  puedeEmitir: boolean;

  @ApiProperty({
    nullable: true,
    description: 'Por qué no se puede firmar todavía, si aplica.',
  })
  motivoNoEmitir: string | null;
}

/** Respuesta del envío del acta por correo (RF45). */
export class EnvioActaRespuestaDto {
  @ApiProperty() destinatario: string;
  @ApiProperty() enviadoEn: string;
}

/** URL firmada para descargar el acta (RNF22). */
export class ActaUrlRespuestaDto {
  @ApiProperty() url: string;
}

/** Orden de las prioridades en la pantalla: primero lo más urgente (RF40). */
const ORDEN_PRIORIDAD: Record<PrioridadMejora, number> = {
  ALTA: 0,
  MEDIA: 1,
  SIN_PRIORIDAD: 2,
};

/**
 * Filas de indicadores evaluados con su prioridad de mejora (RF39, RF40).
 *
 * Solo entran los que tienen valor; la prioridad sale del valor. El orden es
 * el de la pantalla: por prioridad y, dentro de ella, del valor más bajo al
 * más alto (los de menor puntaje primero, RF40).
 */
export function filasDeMejora(
  calculo: CalculoVisita,
  indicadores: readonly Indicador[],
  documentos: readonly DocumentoEvaluado[],
): IndicadorMejoraRespuestaDto[] {
  const porCodigo = new Map(
    indicadores.map((indicador) => [indicador.codigo, indicador]),
  );
  const pendientes = new Set(
    documentos
      .filter((documento) => documento.pendiente)
      .map((documento) => documento.indicadorCodigo),
  );

  return calculo.indicadores
    .filter((indicador) => indicador.valor !== null)
    .map((indicador) => {
      const delCatalogo = porCodigo.get(indicador.codigo);
      const prioridad = prioridadDeMejora(indicador.valor ?? 0);
      return {
        codigo: indicador.codigo,
        nombre: delCatalogo?.nombre ?? indicador.codigo,
        grupo: indicador.grupo,
        etiquetaGrupo: ETIQUETA_GRUPO_MEDIDAS[indicador.grupo],
        valor: indicador.valor,
        pendiente: pendientes.has(indicador.codigo),
        prioridad,
        etiquetaPrioridad: ETIQUETA_PRIORIDAD[prioridad],
      };
    })
    .sort(
      (izquierda, derecha) =>
        ORDEN_PRIORIDAD[izquierda.prioridad] -
          ORDEN_PRIORIDAD[derecha.prioridad] ||
        (izquierda.valor ?? 0) - (derecha.valor ?? 0) ||
        izquierda.nombre.localeCompare(derecha.nombre, 'es'),
    );
}

/**
 * ¿Se puede firmar una nueva acta? (RF41–RF44).
 *
 * Una acta definitiva no se reemplaza (RNF10); con documentos pendientes hay
 * que esperar a que lleguen —o a que venza el plazo— para recalcular (RF44);
 * y no se firma con indicadores sin evaluar.
 */
export function decidirEmision(
  estado: EstadoVisita,
  completo: boolean,
  hayPendientes: boolean,
  acta: Acta | null,
): { puedeEmitir: boolean; motivo: string | null } {
  if (acta?.definitiva) {
    return {
      puedeEmitir: false,
      motivo:
        'La visita ya tiene acta definitiva: no se modifica ni se reemplaza (RNF10).',
    };
  }
  if (!esEditable(estado)) {
    return {
      puedeEmitir: false,
      motivo: 'La visita está cerrada o todavía no admite el cierre.',
    };
  }
  if (!completo) {
    return {
      puedeEmitir: false,
      motivo:
        'Todavía faltan indicadores sin evaluar: complete las fases para poder firmar el acta.',
    };
  }
  if (acta && hayPendientes) {
    return {
      puedeEmitir: false,
      motivo:
        'Aún hay documentos pendientes: entréguelos antes del vencimiento para recalcular y emitir el acta definitiva (RF44).',
    };
  }
  return { puedeEmitir: true, motivo: null };
}

/** Arma el bloque de la Fase IV a partir del cálculo del cierre (M7). */
export function mapearFase4(opciones: {
  calculo: CalculoVisita;
  indicadores: readonly Indicador[];
  documentos: readonly DocumentoEvaluado[];
  acta: Acta | null;
  estado: EstadoVisita;
  ahora: Date;
}): Fase4RespuestaDto {
  const { calculo, indicadores, documentos, acta, estado, ahora } = opciones;
  const filas = filasDeMejora(calculo, indicadores, documentos);
  const pendientes = filas.filter((fila) => fila.pendiente).length;
  const vencimiento = acta?.vencimientoDocumentos ?? null;
  const decision = decidirEmision(
    estado,
    calculo.completo,
    pendientes > 0,
    acta,
  );

  return {
    completo: calculo.completo,
    indicadoresSinEvaluar: calculo.indicadores.filter(
      (indicador) => indicador.valor === null && !indicador.noAplica,
    ).length,
    indicadores: filas,
    final: calculo.final,
    clasificacion: calculo.clasificacion,
    etiquetaClasificacion: calculo.clasificacion
      ? ETIQUETA_CLASIFICACION[calculo.clasificacion]
      : null,
    grupos: calculo.grupos.map((grupo) => ({ ...grupo })),
    documentosPendientes: pendientes,
    vencimiento: vencimiento ? vencimiento.toISOString() : null,
    vencido: vencimiento !== null && vencimiento.getTime() <= ahora.getTime(),
    acta: acta ? resumirActa(acta) : null,
    puedeEmitir: decision.puedeEmitir,
    motivoNoEmitir: decision.motivo,
  };
}

/** Bloque de la Fase IV cuando la visita todavía no tiene nada que cerrar. */
export function fase4Vacia(): Fase4RespuestaDto {
  return {
    completo: false,
    indicadoresSinEvaluar: 0,
    indicadores: [],
    final: null,
    clasificacion: null,
    etiquetaClasificacion: null,
    grupos: [],
    documentosPendientes: 0,
    vencimiento: null,
    vencido: false,
    acta: null,
    puedeEmitir: false,
    motivoNoEmitir: 'La inspección todavía no ha comenzado.',
  };
}

/** Convierte la fila de acta en el resumen de la respuesta (RF41–RF45). */
export function resumirActa(acta: Acta): ActaResumenRespuestaDto {
  return {
    id: acta.id,
    version: acta.version,
    definitiva: acta.definitiva,
    firmadaEn: acta.firmadaEn.toISOString(),
    firmadaPorNombre: acta.firmadaPorNombre,
    documentosPendientes: acta.documentosPendientes,
    vencimientoDocumentos: acta.vencimientoDocumentos?.toISOString() ?? null,
    calificacion: acta.calificacion === null ? null : Number(acta.calificacion),
    clasificacion: acta.clasificacion ?? null,
    etiquetaClasificacion: acta.clasificacion
      ? ETIQUETA_CLASIFICACION[acta.clasificacion]
      : null,
    correoEnviadoEn: acta.correoEnviadoEn?.toISOString() ?? null,
    correoDestinatario: acta.correoDestinatario ?? null,
    tamano: acta.tamano,
    huella: acta.huella,
  };
}
