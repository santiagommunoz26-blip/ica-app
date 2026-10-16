import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Metodologia } from '../../metodologia/entities/metodologia.entity.js';
import { GrupoProductivo } from '../../metodologia/metodologia.tipos.js';
import { Visita } from '../../visitas/entities/visita.entity.js';
import { Galpon } from './galpon.entity.js';

/**
 * Inspección de una visita: su Fase I y el cuaderno donde el motor de cálculo
 * (M6) irá guardando los puntajes (M3 · RF13–RF17).
 *
 * Es una por visita (1 a 1). Guarda la **versión de la metodología** con la que
 * se hizo: aunque el catálogo cambie después, la visita conserva sus reglas
 * (RF49, ADR-001). Los datos del predio y del responsable (nombre, municipio,
 * vereda, número de aves, sistema de producción) viven en el predio, porque
 * siguen al predio y no a la visita; aquí queda lo que decide la Fase I: el
 * grupo productivo, la fecha y hora y los galpones.
 */
@Entity('inspeccion')
export class Inspeccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_inspeccion_visita', { unique: true })
  @Column({ type: 'uuid', name: 'visita_id' })
  visitaId: string;

  @ManyToOne(() => Visita, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  /** Versión de la metodología usada (RF49). */
  @Column({ type: 'uuid', name: 'metodologia_id', nullable: true })
  metodologiaId: string | null;

  @ManyToOne(() => Metodologia, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'metodologia_id' })
  metodologia: Metodologia | null;

  /** Grupo productivo elegido por el inspector (RF15). */
  @Column({
    type: 'varchar',
    length: 30,
    name: 'grupo_productivo',
    nullable: true,
  })
  grupoProductivo: GrupoProductivo | null;

  /** Fecha y hora de la ficha (RF13). */
  @Column({ type: 'timestamptz', name: 'fecha_hora', nullable: true })
  fechaHora: Date | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /**
   * Respuestas de la inspección (M4/M5), por código de indicador. En M3 se crea
   * vacío: el modelo híbrido de ADR-001 guarda las respuestas de la visita como
   * JSON con el snapshot de la versión.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  respuestas: Record<string, unknown>;

  @OneToMany(() => Galpon, (galpon) => galpon.inspeccion)
  galpones: Galpon[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
