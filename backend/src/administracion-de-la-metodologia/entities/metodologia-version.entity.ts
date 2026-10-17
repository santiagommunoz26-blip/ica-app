import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('metodologia_version')
export class MetodologiaVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_metodologia_version_nombre')
  @Column({ type: 'varchar', length: 40, unique: true })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Index('IDX_metodologia_version_activa')
  @Column({ type: 'boolean', default: false })
  activa: boolean;

  @Column({ type: 'uuid', name: 'creada_por', nullable: true })
  creadaPor: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
