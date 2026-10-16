import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Visita } from '../../visitas/entities/visita.entity.js';

/**
 * Evidencia de una inspección (M4 · RF23, ADR-003): solo los **metadatos**.
 *
 * El binario (la foto) vive en el almacenamiento de objetos —MinIO en local,
 * Cloud Storage en producción— y nunca pasa por la base ni por la API: el
 * navegador lo sube y lo consulta con URLs firmadas de vida corta. Aquí queda
 * lo que permite autorizar, auditar y listar: a qué visita y a qué indicador
 * pertenece, su tipo, tamaño, hash y la ruta dentro del bucket.
 */
@Entity('evidencia')
@Index('IDX_evidencia_visita', ['visitaId'])
@Index('UQ_evidencia_ruta', ['ruta'], { unique: true })
export class Evidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'visita_id' })
  visitaId: string;

  @ManyToOne(() => Visita, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  /** Galpón al que pertenece la evidencia (RF16); nulo si es de la visita. */
  @Column({ type: 'int', name: 'galpon_numero', nullable: true })
  galponNumero: number | null;

  /** Indicador al que acompaña (RF23); nulo si es de la visita. */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'indicador_codigo',
    nullable: true,
  })
  indicadorCodigo: string | null;

  /** Nombre original del archivo. */
  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  /** Tipo MIME (image/jpeg, image/png…). */
  @Column({ type: 'varchar', length: 100 })
  tipo: string;

  /** Tamaño en bytes. */
  @Column({ type: 'integer' })
  tamano: number;

  /** Huella SHA-256 del archivo, si el equipo la calculó. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  /** Ruta del objeto dentro del bucket (clave S3). */
  @Column({ type: 'varchar', length: 500 })
  ruta: string;

  /** Verdadero cuando el archivo ya llegó al almacenamiento. */
  @Column({ type: 'boolean', default: false })
  confirmada: boolean;

  /** Quién la subió (RNF11). */
  @Column({ type: 'uuid', name: 'autor_id', nullable: true })
  autorId: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'autor_id' })
  autor: Usuario | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'creada_en' })
  creadaEn: Date;
}
