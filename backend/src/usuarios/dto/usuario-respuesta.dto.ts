import { ApiProperty } from '@nestjs/swagger';
import type { Usuario } from '../entities/usuario.entity.js';
import type { RegistroAcceso } from '../entities/registro-acceso.entity.js';
import {
  EstadoUsuario,
  ETIQUETA_ROL,
  permisosDeRol,
  Rol,
} from '../../common/roles.js';

/**
 * Representación pública de un usuario. Es la única forma en que el usuario
 * sale de la API: nunca se exponen `passwordHash` ni `pinHash` (RNF07).
 */
export class UsuarioRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana Ruiz' })
  nombreCompleto: string;

  @ApiProperty({ example: 'ana.ruiz@entidad.gov.co' })
  correo: string;

  @ApiProperty({ enum: Rol, enumName: 'Rol' })
  rol: Rol;

  @ApiProperty({ example: 'Inspector' })
  etiquetaRol: string;

  @ApiProperty({ enum: EstadoUsuario, enumName: 'EstadoUsuario' })
  estado: EstadoUsuario;

  @ApiProperty({ example: true })
  debeCambiarPassword: boolean;

  @ApiProperty({
    example: true,
    description: 'Si ya configuró su PIN sin conexión.',
  })
  tienePin: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoAcceso: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: [String], description: 'Permisos que otorga el rol.' })
  permisos: string[];
}

/** Convierte una entidad Usuario en su representación pública. */
export function mapearUsuario(usuario: Usuario): UsuarioRespuestaDto {
  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
    correo: usuario.correo,
    rol: usuario.rol,
    etiquetaRol: ETIQUETA_ROL[usuario.rol],
    estado: usuario.estado,
    debeCambiarPassword: usuario.debeCambiarPassword,
    tienePin: !!usuario.pinActualizadoEn,
    ultimoAcceso: usuario.ultimoAcceso,
    createdAt: usuario.createdAt,
    permisos: [...permisosDeRol(usuario.rol)]
      .filter((permiso) => permiso.concedido)
      .map((permiso) => permiso.clave),
  };
}

/** Usuario creado: incluye la contraseña temporal, que se muestra una sola vez. */
export class UsuarioCreadoRespuestaDto {
  @ApiProperty({ type: UsuarioRespuestaDto })
  usuario: UsuarioRespuestaDto;

  @ApiProperty({
    example: 'Kf7mNp2qRs9t',
    description:
      'Contraseña temporal. Solo se devuelve al crear el usuario o al restablecer su contraseña; el usuario deberá cambiarla en su primer acceso (RF07).',
  })
  passwordTemporal: string;
}

/** Página de resultados de la lista de usuarios. */
export class ListaUsuariosRespuestaDto {
  @ApiProperty({ type: [UsuarioRespuestaDto] })
  datos: UsuarioRespuestaDto[];

  @ApiProperty({ example: 7 })
  total: number;

  @ApiProperty({ example: 1 })
  pagina: number;

  @ApiProperty({ example: 20 })
  porPagina: number;
}

/** Entrada de la bitácora de auditoría (RNF11). */
export class RegistroAccesoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  usuarioId: string | null;

  @ApiProperty({ type: String, nullable: true })
  correo: string | null;

  @ApiProperty({ example: 'INICIO_SESION' })
  evento: string;

  @ApiProperty({ type: String, nullable: true })
  direccionIp: string | null;

  @ApiProperty({ type: String, nullable: true })
  detalle: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/** Convierte una fila de la bitácora en su representación pública. */
export function mapearRegistroAcceso(
  registro: RegistroAcceso,
): RegistroAccesoRespuestaDto {
  return {
    id: registro.id,
    usuarioId: registro.usuarioId,
    correo: registro.correo,
    evento: registro.evento,
    direccionIp: registro.direccionIp,
    detalle: registro.detalle,
    createdAt: registro.createdAt,
  };
}
