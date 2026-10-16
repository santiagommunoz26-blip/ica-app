import { ApiProperty } from '@nestjs/swagger';
import { GrupoMedidas } from '../../metodologia/metodologia.tipos.js';
import {
  Clasificacion,
  ETIQUETA_CLASIFICACION,
} from '../../visitas/visitas.tipos.js';
import type { CalculoVisita } from '../calculo.tipos.js';

/**
 * Resultado del motor de cálculo (M6 · RF34–RF38) tal como lo ve la interfaz:
 * el detalle por indicador, el aporte de cada grupo y la calificación final
 * con su clasificación. La interfaz lo muestra en vivo (RF37) y el cierre
 * (M7) lo usa para la pantalla de resultados y el acta.
 */

/** Cálculo de un indicador en un galpón (M6 · RF34). */
export class CalculoGalponRespuestaDto {
  @ApiProperty() galponNumero: number;
  @ApiProperty({ nullable: true, description: 'Valor en % (0–100).' })
  valor: number | null;
  @ApiProperty({ description: 'El galpón lo marcó «No aplica» (RF25).' })
  noAplica: boolean;
  @ApiProperty({ description: 'El galpón terminó su evaluación.' })
  completo: boolean;
}

/** Cálculo de un indicador de la visita (M6 · RF34). */
export class CalculoIndicadorRespuestaDto {
  @ApiProperty() codigo: string;
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty({
    nullable: true,
    description: 'Valor del indicador en % (0–100); promedio de los galpones.',
  })
  valor: number | null;
  @ApiProperty({ description: 'Todos los galpones lo excluyeron (RF25).' })
  noAplica: boolean;
  @ApiProperty({ description: 'Quedó terminado (o excluido con motivo).' })
  completo: boolean;
  @ApiProperty({ type: () => CalculoGalponRespuestaDto, isArray: true })
  galpones: CalculoGalponRespuestaDto[];
}

/** Aporte de un grupo de medidas (M6 · RF35). */
export class CalculoGrupoRespuestaDto {
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty() etiqueta: string;
  @ApiProperty({ description: 'Peso del grupo en el perfil del predio.' })
  peso: number;
  @ApiProperty() indicadoresConValor: number;
  @ApiProperty() indicadoresTotal: number;
  @ApiProperty({ nullable: true, description: 'Promedio del grupo, en %.' })
  promedio: number | null;
  @ApiProperty({
    nullable: true,
    description: 'Aporte al resultado: promedio × peso.',
  })
  aporte: number | null;
}

/** Resultado del motor para una visita (M6 · RF34–RF36). */
export class CalculoRespuestaDto {
  @ApiProperty({
    description:
      'Todos los indicadores aplicables quedaron con valor o «No aplica».',
  })
  completo: boolean;

  @ApiProperty({ type: () => CalculoIndicadorRespuestaDto, isArray: true })
  indicadores: CalculoIndicadorRespuestaDto[];

  @ApiProperty({ type: () => CalculoGrupoRespuestaDto, isArray: true })
  grupos: CalculoGrupoRespuestaDto[];

  @ApiProperty({
    nullable: true,
    description: 'Calificación final en %: suma de los aportes (RF36).',
  })
  final: number | null;

  @ApiProperty({
    enum: Clasificacion,
    enumName: 'Clasificacion',
    nullable: true,
  })
  clasificacion: Clasificacion | null;

  @ApiProperty({ nullable: true }) etiquetaClasificacion: string | null;
}

/** Cálculo vacío: cuando la visita todavía no tiene datos que calcular. */
export function calculoVacio(): CalculoRespuestaDto {
  return {
    completo: false,
    indicadores: [],
    grupos: [],
    final: null,
    clasificacion: null,
    etiquetaClasificacion: null,
  };
}

/** Convierte el resultado del motor en la respuesta de la API (M6). */
export function mapearCalculo(calculo: CalculoVisita): CalculoRespuestaDto {
  return {
    completo: calculo.completo,
    indicadores: calculo.indicadores.map((indicador) => ({
      codigo: indicador.codigo,
      grupo: indicador.grupo,
      valor: indicador.valor,
      noAplica: indicador.noAplica,
      completo: indicador.completo,
      galpones: indicador.galpones.map((galpon) => ({ ...galpon })),
    })),
    grupos: calculo.grupos.map((grupo) => ({ ...grupo })),
    final: calculo.final,
    clasificacion: calculo.clasificacion,
    etiquetaClasificacion: calculo.clasificacion
      ? ETIQUETA_CLASIFICACION[calculo.clasificacion]
      : null,
  };
}
