import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M6 · Motor de cálculo (RF34–RF38).
 *
 * Dos columnas nuevas, sin tablas:
 *
 * 1. `indicador.escala_rangos` (RF38, RF47): los rangos con los que una
 *    medición numérica se convierte en 0/1/2. Los documentos citan los de la
 *    mortalidad (RF30) y RNF17 pide que no queden fijos en el código: se
 *    siembran aquí para el indicador de mortalidad (MBG-09), por grupo
 *    productivo, y el motor de cálculo (M6) los lee del catálogo. M8 los edita.
 *
 * 2. `inspeccion.resultado` (RF34–RF36): el resumen de la última pasada del
 *    motor (grupos, calificación y clasificación). La visita guarda además la
 *    calificación y la clasificación en sus propias columnas (M6 las escribe);
 *    aquí queda el desglose por grupo que necesita el panel (RF10).
 */
export class MotorCalculo1792540800000 implements MigrationInterface {
  name = 'MotorCalculo1792540800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Catálogo: rangos de la escala numérica (RF38, RF47) ---
    await queryRunner.query(
      `ALTER TABLE "indicador" ADD COLUMN "escala_rangos" jsonb`,
    );

    // Los rangos de la mortalidad (RF30), ahora como datos del catálogo: en
    // engorde hasta 6 % son 2 puntos y hasta 9 % es 1; en ponedoras, 12 % y
    // 14 % (en piso y en jaula). El resto es 0.
    const rangosMortalidad = {
      POLLO_ENGORDE: [
        { puntaje: 2, max: 6 },
        { puntaje: 1, max: 9 },
        { puntaje: 0, max: null },
      ],
      PONEDORA_PISO: [
        { puntaje: 2, max: 12 },
        { puntaje: 1, max: 14 },
        { puntaje: 0, max: null },
      ],
      PONEDORA_JAULA: [
        { puntaje: 2, max: 12 },
        { puntaje: 1, max: 14 },
        { puntaje: 0, max: null },
      ],
    };
    await queryRunner.query(
      `UPDATE "indicador" SET "escala_rangos" = $1::jsonb WHERE "codigo" = 'MBG-09'`,
      [JSON.stringify(rangosMortalidad)],
    );

    // --- Inspección: resultado del motor (RF34–RF36) ---
    await queryRunner.query(
      `ALTER TABLE "inspeccion" ADD COLUMN "resultado" jsonb`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '7' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspeccion" DROP COLUMN "resultado"`);
    await queryRunner.query(
      `ALTER TABLE "indicador" DROP COLUMN "escala_rangos"`,
    );

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '6' WHERE "key" = 'schema_version'`,
    );
  }
}
