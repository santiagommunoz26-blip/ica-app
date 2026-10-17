import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import type { Clasificacion } from '../../visitas/visitas.tipos.js';
import { Visita } from '../../visitas/entities/visita.entity.js';

/**
 * Acta oficial de una visita (M7 · RF41–RF45).
 *
 * Cada emisión queda como una **versión** (RF44): la primera con documentos
 * pendientes es provisional y lleva el vencimiento del plazo (RF43); cuando
 * los documentos llegan a tiempo —o cuando vence el plazo—, la calificación
 * queda definitiva y una visita nunca vuelve a tener dos actas vigentes. Una
 * acta definitiva ya no se modifica (RNF10): por eso el PDF vive en el
 * almacenamiento de objetos con su huella (SHA-256), y aquí solo se guardan
 * los metadatos.
 *
 * La firma del inspector (RF42) se guarda como imagen PNG en el
 * almacenamiento y queda estampada dentro del PDF.
 */
@Entity('acta')
@Unique('UQ_acta_visita_version', ['visitaId', 'version'])
export class Acta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_acta_visita')
  @Column({ type: 'uuid', name: 'visita_id' })
  visitaId: string;

  @ManyToOne(() => Visita, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  /** Versión del acta dentro de la visita: 1, 2… (RF44). */
  @Column({ type: 'int' })
  version: number;

  /**
   * ¿Es la acta definitiva? (RNF10). La primera emisión es provisional
   * cuando quedan documentos pendientes; si no hay pendientes, nace
   * definitiva. Al vencerse el plazo sin que lleguen, la provisional queda
   * como definitiva.
   */
  @Column({ type: 'boolean', default: false })
  definitiva: boolean;

  /** Clave del PDF en el almacenamiento (ADR-003). */
  @Column({ type: 'varchar', length: 300 })
  archivo: string;

  /** Huella SHA-256 del PDF, para comprobar que no cambió (RNF10). */
  @Column({ type: 'varchar', length: 64 })
  huella: string;

  /** Tamaño del PDF en bytes. */
  @Column({ type: 'int' })
  tamano: number;

  /** Clave de la imagen de la firma del inspector en el almacenamiento. */
  @Column({ type: 'varchar', length: 300, name: 'firma_archivo' })
  firmaArchivo: string;

  @Column({ type: 'uuid', name: 'firmada_por_id', nullable: true })
  firmadaPorId: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'firmada_por_id' })
  firmadaPor: Usuario | null;

  /** Nombre de quien firmó, congelado al momento de la firma (RF42). */
  @Column({ type: 'varchar', length: 150, name: 'firmada_por_nombre' })
  firmadaPorNombre: string;

  @Column({ type: 'timestamptz', name: 'firmada_en' })
  firmadaEn: Date;

  /** Documentos pendientes al momento de emitir (RF43). */
  @Column({ type: 'int', name: 'documentos_pendientes', default: 0 })
  documentosPendientes: number;

  /** Vencimiento del plazo, si quedaron documentos pendientes (RF43). */
  @Column({
    type: 'timestamptz',
    name: 'vencimiento_documentos',
    nullable: true,
  })
  vencimientoDocumentos: Date | null;

  /** Calificación del acta, congelada al firmarla (RF39/RF44). */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  calificacion: string | null;

  /** Nivel de bienestar del acta, congelado al firmarla (RF39). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  clasificacion: Clasificacion | null;

  /** Fecha del último envío por correo al responsable (RF45). */
  @Column({ type: 'timestamptz', name: 'correo_enviado_en', nullable: true })
  correoEnviadoEn: Date | null;

  /** Destinatario del último envío (RF45). */
  @Column({
    type: 'varchar',
    length: 180,
    name: 'correo_destinatario',
    nullable: true,
  })
  correoDestinatario: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
