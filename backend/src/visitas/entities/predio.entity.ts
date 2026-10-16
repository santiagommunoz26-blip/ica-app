import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoPredio } from '../visitas.tipos.js';

/**
 * Predio (finca o granja) al que se asocia una visita (RF08).
 *
 * En M2 se registran solo los datos que la programación y los filtros
 * necesitan: nombre, municipio, vereda y tipo de predio (RF11 filtra por
 * municipio y por tipo). La ficha general del predio (responsable, número de
 * aves, sistema de producción y demás) la añade la Fase I en M3 (RF13), que
 * además confirma el tipo con la clasificación automática de RF14 (200 aves o
 * más es corral; 199 o menos, traspatio).
 *
 * El tipo que se guarda aquí es el **declarado** al programar la visita: sirve
 * para planificar y filtrar, no sustituye a la clasificación de M3.
 */
@Entity('predio')
export class Predio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_predio_nombre')
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  /** Municipio donde está el predio (RF11 lo usa como filtro). */
  @Column({ type: 'varchar', length: 120 })
  municipio: string;

  @Column({ type: 'varchar', length: 120 })
  vereda: string;

  @Column({ type: 'varchar', length: 20, name: 'tipo_predio' })
  tipoPredio: TipoPredio;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
