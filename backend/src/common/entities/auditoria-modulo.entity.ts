import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auditoria_modulo')
export class AuditoriaModulo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_auditoria_modulo_actor')
  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 60 })
  modulo: string;

  @Column({ type: 'varchar', length: 60 })
  accion: string;

  @Column({ type: 'uuid', name: 'recurso_id', nullable: true })
  recursoId: string | null;

  @Column({ type: 'jsonb', default: {} })
  detalle: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
