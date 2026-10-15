import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Eventos que quedan registrados en la bitácora (RNF11). */
export enum EventoBitacora {
  INICIO_SESION = 'INICIO_SESION',
  INICIO_SESION_FALLIDO = 'INICIO_SESION_FALLIDO',
  CIERRE_SESION = 'CIERRE_SESION',
  CAMBIO_PASSWORD = 'CAMBIO_PASSWORD',
  PASSWORD_RESTABLECIDA = 'PASSWORD_RESTABLECIDA',
  PASSWORD_RECUPERACION_SOLICITADA = 'PASSWORD_RECUPERACION_SOLICITADA',
  PIN_CONFIGURADO = 'PIN_CONFIGURADO',
  PIN_FALLIDO = 'PIN_FALLIDO',
  PIN_VERIFICADO = 'PIN_VERIFICADO',
  USUARIO_CREADO = 'USUARIO_CREADO',
  USUARIO_EDITADO = 'USUARIO_EDITADO',
  USUARIO_ESTADO_CAMBIADO = 'USUARIO_ESTADO_CAMBIADO',
  PASSWORD_RESTABLECIDA_POR_ADMIN = 'PASSWORD_RESTABLECIDA_POR_ADMIN',
}

/**
 * Bitácora de auditoría (regla del módulo M1 «cada ingreso queda registrado»
 * y RNF11: acciones críticas registradas en una bitácora que no puede
 * editarse desde la aplicación).
 *
 * Es de **solo escritura**: este proyecto nunca actualiza ni borra filas de
 * esta tabla (no hay endpoint de edición ni borrado).
 */
@Entity('registro_acceso')
export class RegistroAcceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'usuario_id', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 180, name: 'correo', nullable: true })
  correo: string | null;

  @Column({ type: 'varchar', length: 40 })
  evento: EventoBitacora;

  @Column({ type: 'varchar', length: 45, name: 'direccion_ip', nullable: true })
  direccionIp: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'agente_usuario',
    nullable: true,
  })
  agenteUsuario: string | null;

  @Column({ type: 'text', name: 'detalle', nullable: true })
  detalle: string | null;

  @Index('IDX_registro_acceso_created_at')
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
