import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity.js';

/**
 * Sesión con token de refresco (RF01, RF02, RNF07).
 *
 * Se guarda la **huella** del token (nunca el token), su caducidad y si fue
 * revocado. Permite cerrar sesión de verdad (RF02) y rotar el token en cada
 * refresco, de modo que un token robado deja de servir tras usarse.
 */
@Entity('sesion')
export class Sesion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @Index('UQ_sesion_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expira_en' })
  expiraEn: Date;

  @Column({ type: 'timestamptz', name: 'revocada_en', nullable: true })
  revocadaEn: Date | null;

  @Column({ type: 'varchar', length: 45, name: 'direccion_ip', nullable: true })
  direccionIp: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'agente_usuario',
    nullable: true,
  })
  agenteUsuario: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
