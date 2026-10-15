import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Metadatos de la aplicación en formato clave/valor.
 *
 * Es infraestructura, no dominio: sirve para registrar datos técnicos (por
 * ejemplo la versión del esquema) y para comprobar que el runner de
 * migraciones y TypeORM funcionan de extremo a extremo.
 */
@Entity('app_metadata')
export class AppMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
