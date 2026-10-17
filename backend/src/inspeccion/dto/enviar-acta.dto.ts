import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

/** Envío del acta al responsable por correo (M7 · RF45). */
export class EnviarActaDto {
  @ApiPropertyOptional({
    example: 'carlos.rojas@correo.com',
    description:
      'Destinatario del acta; si no se indica, se usa el correo del responsable (RF45).',
  })
  @IsOptional()
  @IsEmail(
    {},
    { message: 'El correo del destinatario no tiene un formato válido.' },
  )
  destinatario?: string;
}
