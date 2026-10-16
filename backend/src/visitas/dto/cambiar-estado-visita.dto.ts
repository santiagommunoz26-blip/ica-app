import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoVisita } from '../visitas.tipos.js';

/** Cambio de estado de una visita (RF09). */
export class CambiarEstadoVisitaDto {
  @ApiProperty({ enum: EstadoVisita, enumName: 'EstadoVisita' })
  @IsEnum(EstadoVisita)
  estado: EstadoVisita;
}
