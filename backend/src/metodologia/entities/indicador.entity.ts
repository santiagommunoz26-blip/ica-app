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
import { GrupoMedidas, GrupoProductivo } from '../metodologia.tipos.js';
import { Metodologia } from './metodologia.entity.js';

/**
 * Indicador del catálogo de la metodología (RF46, RF47).
 *
 * Es el indicador que se califica durante la inspección (M4/M5). Cada indicador
 * pertenece a un grupo de medidas y declara a qué grupos productivos aplica: de
 * ahí sale la carga automática de RF17. Nada de esto se escribe en el código
 * (RNF17): lo administra M8.
 */
@Entity('indicador')
@Index('IDX_indicador_metodologia', ['metodologiaId'])
@Index('UQ_indicador_codigo', ['metodologiaId', 'codigo'], { unique: true })
export class Indicador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'metodologia_id' })
  metodologiaId: string;

  @ManyToOne(() => Metodologia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metodologia_id' })
  metodologia: Metodologia;

  @Column({ type: 'varchar', length: 10 })
  grupo: GrupoMedidas;

  @Column({ type: 'varchar', length: 20 })
  codigo: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  /** Método de evaluación (RF46). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  metodo: string | null;

  @Column({ type: 'int', default: 0 })
  orden: number;

  /** Rango de la escala de puntaje (RF19, RF47): 0 a 2. */
  @Column({ type: 'int', name: 'escala_min', default: 0 })
  escalaMin: number;

  @Column({ type: 'int', name: 'escala_max', default: 2 })
  escalaMax: number;

  /**
   * Grupos productivos a los que aplica (RF46, RF17). Se guarda como lista de
   * textos: es el catálogo normalizado de ADR-001 y evita una tabla de enlace
   * solo para una lista corta y fija de tres valores.
   */
  @Column({ type: 'text', array: true, name: 'grupos_productivos' })
  gruposProductivos: GrupoProductivo[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
