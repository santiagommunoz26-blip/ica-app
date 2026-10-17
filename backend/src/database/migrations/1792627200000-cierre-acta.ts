import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M7 · Cierre y reportes, Fase IV (RF39–RF45).
 *
 * Dos cambios:
 *
 * 1. Tabla `acta` (RF41–RF45): cada emisión del acta oficial como una
 *    versión firmada por el inspector, con la huella SHA-256 del PDF que vive
 *    en el almacenamiento de objetos (ADR-003). Guarda el vencimiento del
 *    plazo de documentos (RF43), la marca de definitiva (RNF10) y el último
 *    envío por correo al responsable (RF45).
 *
 * 2. `predio.correo_responsable` (RF45): el correo al que se envía el acta.
 *    Es un dato de la ficha que el wireframe no muestra; se agrega como campo
 *    opcional de la Fase I (desviación mínima, a informar al usuario).
 */
export class CierreActa1792627200000 implements MigrationInterface {
  name = 'CierreActa1792627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "acta" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "visita_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "definitiva" boolean NOT NULL DEFAULT false,
        "archivo" character varying(300) NOT NULL,
        "huella" character varying(64) NOT NULL,
        "tamano" integer NOT NULL,
        "firma_archivo" character varying(300) NOT NULL,
        "firmada_por_id" uuid,
        "firmada_por_nombre" character varying(150) NOT NULL,
        "firmada_en" timestamp with time zone NOT NULL,
        "documentos_pendientes" integer NOT NULL DEFAULT 0,
        "vencimiento_documentos" timestamp with time zone,
        "calificacion" numeric(5,2),
        "clasificacion" character varying(20),
        "correo_enviado_en" timestamp with time zone,
        "correo_destinatario" character varying(180),
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_acta" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_acta_visita_version" UNIQUE ("visita_id", "version"),
        CONSTRAINT "FK_acta_visita" FOREIGN KEY ("visita_id")
          REFERENCES "visita"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_acta_firmada_por" FOREIGN KEY ("firmada_por_id")
          REFERENCES "usuario"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_acta_visita" ON "acta" ("visita_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "predio" ADD COLUMN "correo_responsable" character varying(180)`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '8' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "predio" DROP COLUMN "correo_responsable"`,
    );
    await queryRunner.query(`DROP TABLE "acta"`);

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '7' WHERE "key" = 'schema_version'`,
    );
  }
}
