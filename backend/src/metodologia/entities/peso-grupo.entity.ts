import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoPredio } from '../../visitas/visitas.tipos.js';
import { GrupoMedidas } from '../metodologia.tipos.js';
import { Metodologia } from './metodologia.entity.js';

/**
 * Peso de un grupo de medidas según el perfil del predio (RF14, RF48).
 *
 * Regla de la metodología: corral pesa 35 % animal, 35 % recursos y 30 %
 * gestión; traspatio pesa 60 % animal y 40 % recursos (gestión no aplica, peso
 * 0). Los pesos viven en el catálogo, no en el código (RNF17), y M8 los edita
 * validando que sumen 100 %.
 */
@Entity('peso_grupo')
@Index('UQ_peso_grupo', ['metodologiaId', 'perfil', 'grupo'], { unique: true })
export class PesoGrupo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'metodologia_id' })
  metodologiaId: string;

  @ManyToOne(() => Metodologia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metodologia_id' })
  metodologia: Metodologia;

  /** Perfil del predio: corral o traspatio (RF14). */
  @Column({ type: 'varchar', length: 20 })
  perfil: TipoPredio;

  @Column({ type: 'varchar', length: 10 })
  grupo: GrupoMedidas;

  /** Porcentaje del grupo, 0–100. */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  peso: string;
}
