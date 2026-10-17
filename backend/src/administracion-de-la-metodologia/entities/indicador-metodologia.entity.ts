import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MetodologiaVersion } from './metodologia-version.entity.js';

export type GrupoMedida = 'MBA' | 'MBR' | 'MBG';
export type EscalaIndicador = Record<'0' | '1' | '2', string>;
export const PUNTAJE_NO_APLICA_PREFIX = '[NO_APLICA]';

@Entity('indicador_metodologia')
@Index('UQ_indicador_version_clave', ['versionId', 'clave'], { unique: true })
export class IndicadorMetodologia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'version_id' })
  versionId: string;

  @ManyToOne(() => MetodologiaVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  version: MetodologiaVersion;

  @Column({ type: 'varchar', length: 60 })
  clave: string;

  @Column({ type: 'varchar', length: 180 })
  nombre: string;

  @Column({ type: 'varchar', length: 3, name: 'grupo_medida' })
  grupoMedida: GrupoMedida;

  @Column({ type: 'varchar', length: 80, name: 'metodo_evaluacion' })
  metodoEvaluacion: string;

  @Column({ type: 'text', array: true, name: 'grupos_productivos' })
  gruposProductivos: string[];

  @Column({ type: 'varchar', length: 100, name: 'referencia_manual' })
  referenciaManual: string;

  @Column({ type: 'jsonb', name: 'escala_puntaje' })
  escalaPuntaje: EscalaIndicador;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
