import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Firma y emisión del acta (M7 · RF41–RF43). */
export class EmitirActaDto {
  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgo…',
    description:
      'Firma del inspector dibujada en la pantalla, como PNG en base64 (RF42).',
  })
  @IsString()
  @MinLength(30, { message: 'La firma está vacía.' })
  @MaxLength(450000, { message: 'La firma es demasiado grande.' })
  firma: string;
}
