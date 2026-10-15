import { ApiProperty } from '@nestjs/swagger';
import { UsuarioRespuestaDto } from '../../usuarios/dto/usuario-respuesta.dto.js';

/** Sesión emitida al iniciar sesión o al refrescar (RF01, RF02). */
export class SesionRespuestaDto {
  @ApiProperty({
    description: 'Token de acceso (JWT) para el encabezado Authorization.',
  })
  accessToken: string;

  @ApiProperty({ description: 'Token de refresco opaco, de un solo uso.' })
  refreshToken: string;

  @ApiProperty({
    example: 900,
    description: 'Vigencia del token de acceso, en segundos.',
  })
  expiraEnSegundos: number;

  @ApiProperty({
    example: 604800,
    description: 'Vigencia del token de refresco, en segundos.',
  })
  refreshExpiraEnSegundos: number;

  @ApiProperty({
    example: 30,
    description:
      'Minutos de inactividad tras los cuales la aplicación debe cerrar la sesión (RF02).',
  })
  sesionInactividadMinutos: number;

  @ApiProperty({ type: UsuarioRespuestaDto })
  usuario: UsuarioRespuestaDto;
}

/** Mensaje genérico de confirmación. */
export class MensajeRespuestaDto {
  @ApiProperty({ example: 'Operación realizada correctamente.' })
  mensaje: string;
}

/** Resultado de verificar el PIN. */
export class PinVerificadoRespuestaDto {
  @ApiProperty({ example: true })
  valido: boolean;
}
