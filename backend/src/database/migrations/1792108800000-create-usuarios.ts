import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M1 · Autenticación y usuarios (RF01–RF07).
 *
 * Crea el usuario, sus sesiones con token de refresco, los tokens de
 * restablecimiento de contraseña y la bitácora de auditoría (RNF11).
 */
export class CreateUsuarios1792108800000 implements MigrationInterface {
  name = 'CreateUsuarios1792108800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "usuario" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"nombre_completo" character varying(150) NOT NULL, ` +
        `"correo" character varying(180) NOT NULL, ` +
        `"password_hash" character varying(255) NOT NULL, ` +
        `"rol" character varying(20) NOT NULL, ` +
        `"estado" character varying(10) NOT NULL DEFAULT 'ACTIVO', ` +
        `"debe_cambiar_password" boolean NOT NULL DEFAULT false, ` +
        `"ultimo_acceso" timestamptz, ` +
        `"pin_hash" character varying(255), ` +
        `"pin_actualizado_en" timestamptz, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_usuario" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "UQ_usuario_correo" UNIQUE ("correo"), ` +
        `CONSTRAINT "CK_usuario_rol" CHECK ("rol" IN ('ADMINISTRADOR', 'INSPECTOR', 'CONSULTA')), ` +
        `CONSTRAINT "CK_usuario_estado" CHECK ("estado" IN ('ACTIVO', 'INACTIVO')))`,
    );

    await queryRunner.query(
      `CREATE TABLE "sesion" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"usuario_id" uuid NOT NULL, ` +
        `"token_hash" character varying(64) NOT NULL, ` +
        `"expira_en" timestamptz NOT NULL, ` +
        `"revocada_en" timestamptz, ` +
        `"direccion_ip" character varying(45), ` +
        `"agente_usuario" character varying(255), ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_sesion" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "UQ_sesion_token_hash" UNIQUE ("token_hash"), ` +
        `CONSTRAINT "FK_sesion_usuario" FOREIGN KEY ("usuario_id") ` +
        `REFERENCES "usuario" ("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sesion_usuario_id" ON "sesion" ("usuario_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "token_password" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"usuario_id" uuid NOT NULL, ` +
        `"token_hash" character varying(64) NOT NULL, ` +
        `"expira_en" timestamptz NOT NULL, ` +
        `"usado_en" timestamptz, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_token_password" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "UQ_token_password_token_hash" UNIQUE ("token_hash"), ` +
        `CONSTRAINT "FK_token_password_usuario" FOREIGN KEY ("usuario_id") ` +
        `REFERENCES "usuario" ("id") ON DELETE CASCADE)`,
    );

    await queryRunner.query(
      `CREATE TABLE "registro_acceso" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"usuario_id" uuid, ` +
        `"correo" character varying(180), ` +
        `"evento" character varying(40) NOT NULL, ` +
        `"direccion_ip" character varying(45), ` +
        `"agente_usuario" character varying(255), ` +
        `"detalle" text, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_registro_acceso" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_registro_acceso_usuario" FOREIGN KEY ("usuario_id") ` +
        `REFERENCES "usuario" ("id") ON DELETE SET NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_registro_acceso_created_at" ON "registro_acceso" ("created_at")`,
    );

    // La bitácora es de solo escritura desde la aplicación (RNF11): además de
    // no exponer endpoints de edición, se documenta con un comentario.
    await queryRunner.query(
      `COMMENT ON TABLE "registro_acceso" IS 'Bitácora de auditoría de solo escritura (RNF11)'`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '2' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "registro_acceso"`);
    await queryRunner.query(`DROP TABLE "token_password"`);
    await queryRunner.query(`DROP TABLE "sesion"`);
    await queryRunner.query(`DROP TABLE "usuario"`);
    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '1' WHERE "key" = 'schema_version'`,
    );
  }
}
