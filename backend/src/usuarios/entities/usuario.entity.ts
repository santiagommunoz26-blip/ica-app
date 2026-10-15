import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoUsuario, Rol } from '../../common/roles.js';

/**
 * Usuario del sistema (RF04, RF05).
 *
 * - `correo` es único y se guarda en minúsculas.
 * - `passwordHash` y `pinHash` nunca se seleccionan por defecto
 *   (`select: false`): hay que pedirlos explícitamente, así no se filtran en
 *   las respuestas por descuido (RNF07).
 * - `debeCambiarPassword` obliga a cambiar la contraseña temporal en el
 *   primer acceso (RF07).
 * - Un usuario INACTIVO no puede ingresar (RF05).
 */
@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, name: 'nombre_completo' })
  nombreCompleto: string;

  @Index('UQ_usuario_correo', { unique: true })
  @Column({ type: 'varchar', length: 180 })
  correo: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  rol: Rol;

  @Column({ type: 'varchar', length: 10, default: EstadoUsuario.ACTIVO })
  estado: EstadoUsuario;

  @Column({ type: 'boolean', name: 'debe_cambiar_password', default: false })
  debeCambiarPassword: boolean;

  @Column({ type: 'timestamptz', name: 'ultimo_acceso', nullable: true })
  ultimoAcceso: Date | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'pin_hash',
    nullable: true,
    select: false,
  })
  pinHash: string | null;

  @Column({ type: 'timestamptz', name: 'pin_actualizado_en', nullable: true })
  pinActualizadoEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
