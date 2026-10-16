import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5 · Inspección documental, Fase III (RF27–RF33).
 *
 * Completa el catálogo con lo que la Fase III necesita, sin crear tablas: las
 * respuestas de la fase son semi-estructuradas y van en `inspeccion.respuestas`
 * (JSONB), como decidió ADR-001, en la forma `{ fase3: { documentos: [...] } }`.
 *
 * 1. `exige_firma_profesional` (RF28): si el documento exige, además de la
 *    firma del responsable, la de un MV/MVZ o zootecnista con matrícula
 *    vigente. El wireframe solo la muestra en el POE de bienestar animal, así
 *    que **solo ese queda marcado** mientras no esté el manual (M8 lo edita).
 *
 * 2. `tipo_evaluacion` (RF30): la mortalidad no se califica a ojo, va por
 *    rangos. Se marca el indicador de mortalidad; el resto se califica 0/1/2.
 *
 * 3. La escala de los documentos (RF19): las descripciones que muestra el
 *    wireframe («Cumple completo», «Cumple parcial», «No cumple o no
 *    presentó»), provisionales como todo el catálogo.
 */
export class Fase3Documental1792454400000 implements MigrationInterface {
  name = 'Fase3Documental1792454400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Catálogo: firma profesional y forma de calificación (RF28, RF30) ---
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "exige_firma_profesional" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "tipo_evaluacion" character varying(20) NOT NULL DEFAULT 'PUNTAJE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD CONSTRAINT "CK_indicador_tipo_evaluacion" ` +
        `CHECK ("tipo_evaluacion" IN ('PUNTAJE', 'MORTALIDAD'))`,
    );

    // La mortalidad se califica por rangos (RF30).
    await queryRunner.query(
      `UPDATE "indicador" SET "tipo_evaluacion" = 'MORTALIDAD' WHERE "codigo" = 'MBG-09'`,
    );
    // El POE de bienestar animal es el único que el wireframe muestra con
    // firma de MV/MVZ (RF28); el resto lo define M8 con el manual.
    await queryRunner.query(
      `UPDATE "indicador" SET "exige_firma_profesional" = true WHERE "codigo" = 'MBG-04'`,
    );
    // Escala de los documentos, la del wireframe (provisional).
    await queryRunner.query(
      `UPDATE "indicador" SET "escala_descripciones" = $1 WHERE "grupo" = 'MBG'`,
      [['No cumple o no presentó', 'Cumple parcial', 'Cumple completo']],
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '6' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP CONSTRAINT "CK_indicador_tipo_evaluacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP COLUMN "tipo_evaluacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP COLUMN "exige_firma_profesional"`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '5' WHERE "key" = 'schema_version'`,
    );
  }
}
