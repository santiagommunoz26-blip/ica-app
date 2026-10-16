import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2 · Gestión de visitas (RF08–RF12).
 *
 * Crea el predio con los datos mínimos que la programación y los filtros
 * necesitan (RF08, RF11) y la visita con su inspector, su fecha, su estado y el
 * resultado que llenará el motor de cálculo (M6).
 *
 * El `id` de la visita lo puede proponer el equipo: así una visita programada
 * sin conexión se reenvía sin duplicarse (RF12). Por eso la columna no depende
 * de la secuencia del servidor.
 */
export class CreateVisitas1792195200000 implements MigrationInterface {
  name = 'CreateVisitas1792195200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "predio" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"nombre" character varying(150) NOT NULL, ` +
        `"municipio" character varying(120) NOT NULL, ` +
        `"vereda" character varying(120) NOT NULL, ` +
        `"tipo_predio" character varying(20) NOT NULL, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_predio" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "CK_predio_tipo" CHECK ("tipo_predio" IN ('CORRAL', 'TRASPATIO')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predio_nombre" ON "predio" ("nombre")`,
    );

    await queryRunner.query(
      `CREATE TABLE "visita" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"predio_id" uuid NOT NULL, ` +
        `"inspector_id" uuid NOT NULL, ` +
        `"programada_para" timestamptz NOT NULL, ` +
        `"estado" character varying(25) NOT NULL DEFAULT 'PROGRAMADA', ` +
        `"observaciones" text, ` +
        `"calificacion" numeric(5,2), ` +
        `"clasificacion" character varying(20), ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_visita" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_visita_predio" FOREIGN KEY ("predio_id") REFERENCES "predio" ("id") ON DELETE RESTRICT, ` +
        `CONSTRAINT "FK_visita_inspector" FOREIGN KEY ("inspector_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT, ` +
        `CONSTRAINT "CK_visita_estado" CHECK ("estado" IN ('PROGRAMADA', 'EN_CURSO', 'PENDIENTE_DOCUMENTOS', 'CERRADA')), ` +
        `CONSTRAINT "CK_visita_clasificacion" CHECK ("clasificacion" IS NULL OR "clasificacion" IN ('EXCELENTE', 'ALTO', 'MEDIO', 'BAJO')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visita_predio_id" ON "visita" ("predio_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visita_inspector_id" ON "visita" ("inspector_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visita_programada_para" ON "visita" ("programada_para")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visita_estado" ON "visita" ("estado")`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "visita"."calificacion" IS 'La calcula el motor de cálculo (M6); nula hasta entonces'`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '3' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "visita"`);
    await queryRunner.query(`DROP TABLE "predio"`);
    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '2' WHERE "key" = 'schema_version'`,
    );
  }
}
