import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SistemaProduccion } from '../../metodologia/metodologia.tipos.js';
import { TipoPredio } from '../visitas.tipos.js';

/**
 * Predio (finca o granja) al que se asocia una visita (RF08).
 *
 * En M2 se registran los datos mínimos que la programación y los filtros
 * necesitan: nombre, municipio, vereda y tipo de predio (RF11 filtra por
 * municipio y por tipo). La ficha general (responsable, número de aves y
 * sistema de producción) la completa la Fase I en M3 (RF13), que además
 * confirma el tipo con la clasificación automática de RF14: 200 aves o más es
 * corral; 199 o menos, traspatio.
 *
 * Mientras la ficha no esté guardada, `tipoPredio` es el **declarado** al
 * programar la visita (sirve para planificar y filtrar); al guardar la ficha,
 * pasa a ser el **clasificado** por el número de aves.
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

  /** Responsable o quien atiende la visita (RF13). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  responsable: string | null;

  /** Correo del responsable, al que se envía el acta (RF45; dato de M7). */
  @Column({
    type: 'varchar',
    length: 180,
    name: 'correo_responsable',
    nullable: true,
  })
  correoResponsable: string | null;

  /** Número total de aves, capacidad instalada (RF13). */
  @Column({ type: 'int', name: 'numero_aves', nullable: true })
  numeroAves: number | null;

  /** Sistema de producción (RF13). */
  @Column({
    type: 'varchar',
    length: 30,
    name: 'sistema_produccion',
    nullable: true,
  })
  sistemaProduccion: SistemaProduccion | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
