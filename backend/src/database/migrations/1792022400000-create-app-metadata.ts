import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Primera migración del proyecto: tabla de metadatos técnicos.
 * Comprueba de extremo a extremo el runner de migraciones (S0-4).
 */
export class CreateAppMetadata1792022400000 implements MigrationInterface {
  name = 'CreateAppMetadata1792022400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_metadata" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"key" character varying(100) NOT NULL, ` +
        `"value" text NOT NULL, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_app_metadata" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "UQ_app_metadata_key" UNIQUE ("key"))`,
    );
    await queryRunner.query(
      `INSERT INTO "app_metadata" ("key", "value") VALUES ('schema_version', '1')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_metadata"`);
  }
}
