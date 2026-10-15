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
 * Token de un solo uso para restablecer la contraseña (RF06, RF07).
 * Se guarda su huella, su caducidad y cuándo se usó; una vez usado o vencido
 * ya no sirve.
 */
@Entity('token_password')
export class TokenPassword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @Index('UQ_token_password_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expira_en' })
  expiraEn: Date;

  @Column({ type: 'timestamptz', name: 'usado_en', nullable: true })
  usadoEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
