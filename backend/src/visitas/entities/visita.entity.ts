import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Predio } from './predio.entity.js';
import { Clasificacion, EstadoVisita } from '../visitas.tipos.js';

/**
 * Visita de inspección (RF08, RF09).
 *
 * - Se programa con antelación con un predio, un inspector y fecha y hora.
 * - El estado avanza por los cuatro del documento (RF09); las transiciones
 *   permitidas están en `visitas.tipos.ts`.
 * - `calificacion` y `clasificacion` las calcula el motor de cálculo (M6) y
 *   las emite el cierre (M7). En M2 llegan nulas: la columna existe para que la
 *   lista y el panel muestren el resultado cuando esté (el wireframe ya pinta
 *   esa columna).
 * - El `id` lo puede proponer el cliente: así una visita programada sin conexión
 *   se puede reenviar más de una vez sin duplicarla (RF12, idempotencia).
 */
@Entity('visita')
export class Visita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_visita_predio_id')
  @Column({ type: 'uuid', name: 'predio_id' })
  predioId: string;

  @ManyToOne(() => Predio, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'predio_id' })
  predio: Predio;

  /** Inspector responsable de la visita (RF08). */
  @Index('IDX_visita_inspector_id')
  @Column({ type: 'uuid', name: 'inspector_id' })
  inspectorId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inspector_id' })
  inspector: Usuario;

  /** Fecha y hora acordadas con el productor (RF08, «se acuerda con antelación»). */
  @Index('IDX_visita_programada_para')
  @Column({ type: 'timestamptz', name: 'programada_para' })
  programadaPara: Date;

  @Index('IDX_visita_estado')
  @Column({ type: 'varchar', length: 25, default: EstadoVisita.PROGRAMADA })
  estado: EstadoVisita;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** Calificación final 0–100 (RF20); la calcula M6. */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  calificacion: string | null;

  /** Nivel de bienestar (RF21, RF36); lo calcula M6. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  clasificacion: Clasificacion | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
