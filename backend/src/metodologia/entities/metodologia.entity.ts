import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Versión de la metodología ICA (RF49).
 *
 * Una visita guarda la versión con la que se hizo, así que un cambio del
 * catálogo crea una versión nueva y **no** altera las visitas cerradas
 * (ADR-001). Solo una versión está activa a la vez: es la que usa una
 * inspección nueva.
 *
 * `provisional` marca el catálogo de ejemplo que se cargó mientras no existe el
 * documento de la metodología ICA v2.0; cuando llegue, se cargará la versión
 * real (M8) y esta quedará marcada como histórica.
 */
@Entity('metodologia')
export class Metodologia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'date', name: 'vigente_desde' })
  vigenteDesde: string;

  @Index('IDX_metodologia_activa')
  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ type: 'boolean', default: false })
  provisional: boolean;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'uuid', name: 'creada_por', nullable: true })
  creadaPor: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
