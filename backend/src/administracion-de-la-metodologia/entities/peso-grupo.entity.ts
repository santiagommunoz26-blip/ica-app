import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MetodologiaVersion } from './metodologia-version.entity.js';
import type { GrupoMedida } from './indicador-metodologia.entity.js';

@Entity('peso_grupo')
@Unique('UQ_peso_version_predio_grupo', [
  'versionId',
  'tipoPredio',
  'grupoMedida',
])
export class PesoGrupo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'version_id' })
  versionId: string;

  @ManyToOne(() => MetodologiaVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  version: MetodologiaVersion;

  @Column({ type: 'varchar', length: 20, name: 'tipo_predio' })
  tipoPredio: 'CORRAL' | 'TRASPATIO';

  @Column({ type: 'varchar', length: 3, name: 'grupo_medida' })
  grupoMedida: GrupoMedida;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  porcentaje: string;
}
