import { ApiProperty } from '@nestjs/swagger';
import { Clasificacion } from '../visitas.tipos.js';
import { VisitaRespuestaDto } from './visita-respuesta.dto.js';

/** Punto de la evolución de la calificación (RF10). */
export class PuntoEvolucionDto {
  @ApiProperty({ example: '2026-10' }) mes: string;
  @ApiProperty({ example: 'Oct' }) etiqueta: string;
  @ApiProperty({ nullable: true, example: 82.4 })
  calificacion: number | null;
  @ApiProperty({ description: 'Visitas cerradas con resultado ese mes.' })
  visitas: number;
}

/** Cuántas visitas con resultado hay en cada nivel (RF10). */
export class ConteoClasificacionDto {
  @ApiProperty({ enum: Clasificacion, enumName: 'Clasificacion' })
  clasificacion: Clasificacion;
  @ApiProperty() etiqueta: string;
  @ApiProperty() cantidad: number;
  @ApiProperty({ example: 42 }) porcentaje: number;
}

/**
 * Promedio por grupo de medidas (RF10). Se llena cuando el motor de cálculo
 * (M6) guarda el resultado; hasta entonces llega vacío.
 */
export class PromedioGrupoDto {
  @ApiProperty({ example: 'MBA' }) grupo: string;
  @ApiProperty({ example: 'Animal (MBA)' }) etiqueta: string;
  @ApiProperty({ nullable: true }) promedio: number | null;
  @ApiProperty({ nullable: true, example: 35 }) peso: number | null;
}

/** Indicadores del panel principal (RF10). */
export class ResumenPanelDto {
  @ApiProperty({ example: 24 }) visitasDelMes: number;
  @ApiProperty({
    nullable: true,
    example: 12,
    description: 'Variación porcentual frente al mes anterior.',
  })
  variacionVisitas: number | null;
  @ApiProperty({ nullable: true, example: 82.4 }) calificacionPromedio:
    number | null;
  @ApiProperty({
    enum: Clasificacion,
    enumName: 'Clasificacion',
    nullable: true,
  })
  clasificacionPromedio: Clasificacion | null;
  @ApiProperty({ nullable: true }) etiquetaClasificacionPromedio: string | null;
  @ApiProperty({
    example: 3,
    description: 'Visitas en estado «Pendiente de documentos».',
  })
  documentosPendientes: number;
  @ApiProperty() totalVisitas: number;
  @ApiProperty() predios: number;
  @ApiProperty({ type: [PuntoEvolucionDto] }) evolucion: PuntoEvolucionDto[];
  @ApiProperty({ type: [ConteoClasificacionDto] })
  distribucion: ConteoClasificacionDto[];
  @ApiProperty({ type: [PromedioGrupoDto] })
  promedioPorGrupo: PromedioGrupoDto[];
  @ApiProperty({
    type: [VisitaRespuestaDto],
    description: 'Las visitas sin cerrar más próximas (wireframe: tres).',
  })
  proximas: VisitaRespuestaDto[];
}
