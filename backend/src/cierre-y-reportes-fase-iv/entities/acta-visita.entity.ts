import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MetodologiaVersion } from '../../administracion-de-la-metodologia/entities/metodologia-version.entity.js';
import { Visita } from '../../visitas/entities/visita.entity.js';

@Entity('acta_visita')
export class ActaVisita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'visita_id', unique: true })
  visitaId: string;

  @ManyToOne(() => Visita, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  @Column({ type: 'uuid', name: 'metodologia_version_id' })
  metodologiaVersionId: string;

  @ManyToOne(() => MetodologiaVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'metodologia_version_id' })
  metodologiaVersion: MetodologiaVersion;

  @Column({ type: 'jsonb', name: 'resultado_snapshot' })
  resultadoSnapshot: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'catalogo_snapshot' })
  catalogoSnapshot: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'documentos_pendientes', default: false })
  documentosPendientes: boolean;

  @Column({ type: 'timestamptz', name: 'vence_documentos', nullable: true })
  venceDocumentos: Date | null;

  @Column({ type: 'timestamptz', name: 'fecha_definitiva', nullable: true })
  fechaDefinitiva: Date | null;

  @Column({ type: 'uuid', name: 'firmada_por' })
  firmadaPor: string;

  @Column({ type: 'varchar', length: 180, name: 'correo_responsable', nullable: true })
  correoResponsable: string | null;

  @Column({ type: 'bytea', name: 'pdf', nullable: true, select: false })
  pdf: Buffer | null;

  @Column({ type: 'bytea', name: 'firma', nullable: true, select: false })
  firma: Buffer | null;

  @Column({ type: 'timestamptz', name: 'correo_enviado_at', nullable: true })
  correoEnviadoAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
