import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M4 · Inspección en galpón, Fase II (RF18–RF26).
 *
 * Prepara lo que la Fase II necesita:
 *
 * 1. El catálogo de indicadores se completa con lo que la interfaz debe
 *    mostrar y validar: la **forma de muestreo** (9 puntos u hojas centinela,
 *    RF18 y RF22), las **descripciones de los puntajes** (RF19) y la
 *    **pregunta** del indicador (RF47). La metodología fuente no está en
 *    docs/, así que solo se siembra lo que el wireframe muestra (la pregunta y
 *    las descripciones de «Calidad de la cama»); lo demás queda pendiente para
 *    M8, que administra el catálogo.
 *
 * 2. La tabla `evidencia`: solo **metadatos** de las fotos (RF23, ADR-003). El
 *    binario vive en el almacenamiento de objetos (MinIO en local, Cloud
 *    Storage en producción) y se sube y consulta con URLs firmadas.
 *
 * Las respuestas de la Fase II **no** crean tablas: son semi-estructuradas y
 * van en `inspeccion.respuestas` (JSONB), como decidió ADR-001. La forma
 * guardada es `{ fase2: { evaluaciones: [...] } }`.
 */
export class Fase2Galpon1792368000000 implements MigrationInterface {
  name = 'Fase2Galpon1792368000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Catálogo: muestreo, escala y pregunta (RF18, RF19, RF22) ---------
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "tipo_muestreo" character varying(20) NOT NULL DEFAULT 'PUNTOS_9'`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "escala_descripciones" text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "pregunta" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD CONSTRAINT "CK_indicador_tipo_muestreo" ` +
        `CHECK ("tipo_muestreo" IN ('PUNTOS_9', 'HOJAS_CENTINELA'))`,
    );

    // Las partículas en el aire se miden con hojas centinela (RF22).
    await queryRunner.query(
      `UPDATE "indicador" SET "tipo_muestreo" = 'HOJAS_CENTINELA' WHERE "codigo" = 'MBR-01'`,
    );
    // La pregunta y las descripciones de la escala de la calidad de la cama
    // son las que muestra el wireframe; el resto las carga M8.
    await queryRunner.query(
      `UPDATE "indicador" SET "pregunta" = $1, "escala_descripciones" = $2 WHERE "codigo" = 'MBR-02'`,
      [
        '¿La calidad de la cama es adecuada?',
        [
          'Muy compacta por humedad',
          'Ligeramente compactada',
          'Suelta, se desmorona',
        ],
      ],
    );

    // --- Evidencias: solo metadatos (RF23, ADR-003) -----------------------
    await queryRunner.query(
      `CREATE TABLE "evidencia" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"visita_id" uuid NOT NULL, ` +
        `"galpon_numero" integer, ` +
        `"indicador_codigo" character varying(20), ` +
        `"nombre" character varying(255) NOT NULL, ` +
        `"tipo" character varying(100) NOT NULL, ` +
        `"tamano" integer NOT NULL, ` +
        `"hash" character varying(64), ` +
        `"ruta" character varying(500) NOT NULL, ` +
        `"confirmada" boolean NOT NULL DEFAULT false, ` +
        `"autor_id" uuid, ` +
        `"creada_en" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_evidencia" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_evidencia_visita" FOREIGN KEY ("visita_id") REFERENCES "visita" ("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "FK_evidencia_autor" FOREIGN KEY ("autor_id") REFERENCES "usuario" ("id") ON DELETE SET NULL, ` +
        `CONSTRAINT "CK_evidencia_tamano" CHECK ("tamano" > 0), ` +
        `CONSTRAINT "CK_evidencia_galpon" CHECK ("galpon_numero" IS NULL OR "galpon_numero" > 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidencia_visita" ON "evidencia" ("visita_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_evidencia_ruta" ON "evidencia" ("ruta")`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '5' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "evidencia"`);

    await queryRunner.query(
      `ALTER TABLE "indicador" DROP CONSTRAINT "CK_indicador_tipo_muestreo"`,
    );
    await queryRunner.query(`ALTER TABLE "indicador" DROP COLUMN "pregunta"`);
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP COLUMN "escala_descripciones"`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP COLUMN "tipo_muestreo"`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '4' WHERE "key" = 'schema_version'`,
    );
  }
}
