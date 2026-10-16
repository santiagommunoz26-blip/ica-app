import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Inspeccion } from './inspeccion.entity.js';

/**
 * Galpón del predio que se va a inspeccionar (RF16).
 *
 * La Fase I los registra con su número y la edad de las aves; con eso el
 * sistema sugiere cuáles evaluar (1 o 2 según el tamaño de la granja,
 * priorizando los de aves de mayor edad).
 */
@Entity('galpon')
@Index('UQ_galpon_inspeccion_numero', ['inspeccionId', 'numero'], {
  unique: true,
})
export class Galpon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'inspeccion_id' })
  inspeccionId: string;

  @ManyToOne(() => Inspeccion, (inspeccion) => inspeccion.galpones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inspeccion_id' })
  inspeccion: Inspeccion;

  /** Número del galpón (1, 2, 3…), como lo nombra el productor. */
  @Column({ type: 'int' })
  numero: number;

  /** Edad de las aves, en semanas; decide cuál se prioriza (RF16). */
  @Column({ type: 'int', name: 'edad_semanas', nullable: true })
  edadSemanas: number | null;

  /** Aves del galpón (opcional). */
  @Column({ type: 'int', nullable: true })
  aves: number | null;

  /** Si el inspector lo va a inspeccionar (lo propone la sugerencia). */
  @Column({ type: 'boolean', default: false })
  seleccionado: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
