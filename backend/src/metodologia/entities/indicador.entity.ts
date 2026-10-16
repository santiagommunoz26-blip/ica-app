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
import {
  GrupoMedidas,
  GrupoProductivo,
  TipoMuestreo,
} from '../metodologia.tipos.js';
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
   * Descripción de cada puntaje de la escala (RF19), en el orden de los
   * puntajes (0, 1, 2…). La metodología no está en docs/, así que el catálogo
   * provisional solo la trae donde el wireframe la muestra (calidad de la
   * cama); el resto queda pendiente y la interfaz lo advierte (M8 las carga).
   */
  @Column({
    type: 'text',
    array: true,
    name: 'escala_descripciones',
    nullable: true,
  })
  escalaDescripciones: string[] | null;

  /** Forma de muestreo del indicador (RF18, RF22). */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'tipo_muestreo',
    default: TipoMuestreo.PUNTOS_9,
  })
  tipoMuestreo: TipoMuestreo;

  /**
   * Pregunta que resume el indicador (RF47), como en el wireframe
   * («¿La calidad de la cama es adecuada?»). Es del catálogo: M8 la edita.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  pregunta: string | null;

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
