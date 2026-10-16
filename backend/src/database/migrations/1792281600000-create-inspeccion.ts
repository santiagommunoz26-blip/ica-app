import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M3 · Apertura y ficha general, Fase I (RF13–RF17).
 *
 * Crea:
 * - el catálogo de la metodología (versión, indicadores y pesos por perfil),
 *   que M8 administrará (RF46–RF49);
 * - la inspección de una visita (Fase I) y sus galpones (RF13–RF16);
 * - los datos del predio que completa la ficha (responsable, número de aves y
 *   sistema de producción, RF13).
 *
 * Además **siembra el catálogo provisional** del proyecto: los pesos y la
 * clasificación por número de aves vienen de los documentos fuente, pero los
 * nombres y la aplicabilidad de los indicadores son marcadores de posición
 * (el documento de la metodología ICA v2.0 no está disponible todavía). El
 * catálogo queda marcado con `provisional = true` para reemplazarlo después.
 */
export class CreateInspeccion1792281600000 implements MigrationInterface {
  name = 'CreateInspeccion1792281600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Ficha del predio (RF13) -----------------------------------------
    await queryRunner.query(
      `ALTER TABLE "predio" ADD COLUMN "responsable" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "predio" ADD COLUMN "numero_aves" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "predio" ADD COLUMN "sistema_produccion" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "predio" ADD CONSTRAINT "CK_predio_sistema_produccion" ` +
        `CHECK ("sistema_produccion" IS NULL OR "sistema_produccion" IN ` +
        `('PISO', 'PASTOREO', 'JAULA', 'ABIERTO_MECANIZADO', 'ABIERTO_NO_MECANIZADO', 'AMBIENTE_CONTROLADO'))`,
    );

    // --- Catálogo de la metodología (RF46–RF49) --------------------------
    await queryRunner.query(
      `CREATE TABLE "metodologia" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"version" character varying(20) NOT NULL, ` +
        `"anio" integer NOT NULL, ` +
        `"vigente_desde" date NOT NULL, ` +
        `"activa" boolean NOT NULL DEFAULT true, ` +
        `"provisional" boolean NOT NULL DEFAULT false, ` +
        `"nota" text, ` +
        `"creada_por" uuid, ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_metodologia" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_metodologia_activa" ON "metodologia" ("activa")`,
    );

    await queryRunner.query(
      `CREATE TABLE "indicador" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"metodologia_id" uuid NOT NULL, ` +
        `"grupo" character varying(10) NOT NULL, ` +
        `"codigo" character varying(20) NOT NULL, ` +
        `"nombre" character varying(200) NOT NULL, ` +
        `"metodo" character varying(200), ` +
        `"orden" integer NOT NULL DEFAULT 0, ` +
        `"escala_min" integer NOT NULL DEFAULT 0, ` +
        `"escala_max" integer NOT NULL DEFAULT 2, ` +
        `"grupos_productivos" text[] NOT NULL DEFAULT '{}', ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_indicador" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_indicador_metodologia" FOREIGN KEY ("metodologia_id") REFERENCES "metodologia" ("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "CK_indicador_grupo" CHECK ("grupo" IN ('MBA', 'MBR', 'MBG')), ` +
        `CONSTRAINT "CK_indicador_escala" CHECK ("escala_min" >= 0 AND "escala_max" <= 2 AND "escala_min" <= "escala_max"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_indicador_metodologia" ON "indicador" ("metodologia_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_indicador_codigo" ON "indicador" ("metodologia_id", "codigo")`,
    );

    await queryRunner.query(
      `CREATE TABLE "peso_grupo" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"metodologia_id" uuid NOT NULL, ` +
        `"perfil" character varying(20) NOT NULL, ` +
        `"grupo" character varying(10) NOT NULL, ` +
        `"peso" numeric(5,2) NOT NULL, ` +
        `CONSTRAINT "PK_peso_grupo" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_peso_grupo_metodologia" FOREIGN KEY ("metodologia_id") REFERENCES "metodologia" ("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "CK_peso_grupo_perfil" CHECK ("perfil" IN ('CORRAL', 'TRASPATIO')), ` +
        `CONSTRAINT "CK_peso_grupo_grupo" CHECK ("grupo" IN ('MBA', 'MBR', 'MBG')), ` +
        `CONSTRAINT "CK_peso_grupo_peso" CHECK ("peso" >= 0 AND "peso" <= 100))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_peso_grupo" ON "peso_grupo" ("metodologia_id", "perfil", "grupo")`,
    );

    // --- Inspección (Fase I) y galpones (RF13–RF16) ----------------------
    await queryRunner.query(
      `CREATE TABLE "inspeccion" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"visita_id" uuid NOT NULL, ` +
        `"metodologia_id" uuid, ` +
        `"grupo_productivo" character varying(30), ` +
        `"fecha_hora" timestamptz, ` +
        `"observaciones" text, ` +
        `"respuestas" jsonb NOT NULL DEFAULT '{}', ` +
        `"created_at" timestamptz NOT NULL DEFAULT now(), ` +
        `"updated_at" timestamptz NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_inspeccion" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_inspeccion_visita" FOREIGN KEY ("visita_id") REFERENCES "visita" ("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "FK_inspeccion_metodologia" FOREIGN KEY ("metodologia_id") REFERENCES "metodologia" ("id") ON DELETE SET NULL, ` +
        `CONSTRAINT "CK_inspeccion_grupo_productivo" CHECK ("grupo_productivo" IS NULL OR "grupo_productivo" IN ('POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA')))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inspeccion_visita" ON "inspeccion" ("visita_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "galpon" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"inspeccion_id" uuid NOT NULL, ` +
        `"numero" integer NOT NULL, ` +
        `"edad_semanas" integer, ` +
        `"aves" integer, ` +
        `"seleccionado" boolean NOT NULL DEFAULT false, ` +
        `"orden" integer NOT NULL DEFAULT 0, ` +
        `CONSTRAINT "PK_galpon" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_galpon_inspeccion" FOREIGN KEY ("inspeccion_id") REFERENCES "inspeccion" ("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "CK_galpon_numero" CHECK ("numero" >= 1))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_galpon_inspeccion_numero" ON "galpon" ("inspeccion_id", "numero")`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "metodologia"."provisional" IS 'Catálogo provisional del proyecto: se reemplaza por el del manual ICA'`,
    );

    await this.sembrarCatalogoProvisional(queryRunner);

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '4' WHERE "key" = 'schema_version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "galpon"`);
    await queryRunner.query(`DROP TABLE "inspeccion"`);
    await queryRunner.query(`DROP TABLE "peso_grupo"`);
    await queryRunner.query(`DROP TABLE "indicador"`);
    await queryRunner.query(`DROP TABLE "metodologia"`);

    await queryRunner.query(
      `ALTER TABLE "predio" DROP CONSTRAINT "CK_predio_sistema_produccion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "predio" DROP COLUMN "sistema_produccion"`,
    );
    await queryRunner.query(`ALTER TABLE "predio" DROP COLUMN "numero_aves"`);
    await queryRunner.query(`ALTER TABLE "predio" DROP COLUMN "responsable"`);

    await queryRunner.query(
      `UPDATE "app_metadata" SET "value" = '3' WHERE "key" = 'schema_version'`,
    );
  }

  /** Carga el catálogo provisional del proyecto (marcadores de posición). */
  private async sembrarCatalogoProvisional(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const nota =
      'Catálogo provisional del proyecto (M3). Los nombres y la aplicabilidad ' +
      'de los indicadores deben reemplazarse por los del documento ' +
      '«Metodología para evaluar bienestar animal en aves de corral y de ' +
      'traspatio (ICA, v2.0, 2024)», que todavía no está disponible. Los pesos ' +
      '(corral 35/35/30; traspatio 60/40) y la clasificación por número de ' +
      'aves sí provienen de los documentos fuente.';

    const filas: { id: string }[] = await queryRunner.query(
      `INSERT INTO "metodologia" ("version", "anio", "vigente_desde", "activa", "provisional", "nota") ` +
        `VALUES ('2.0', 2024, '2024-01-01', true, true, $1) RETURNING "id"`,
      [nota],
    );
    const metodologiaId = filas[0].id;

    const pesos: { perfil: string; grupo: string; peso: number }[] = [
      { perfil: 'CORRAL', grupo: 'MBA', peso: 35 },
      { perfil: 'CORRAL', grupo: 'MBR', peso: 35 },
      { perfil: 'CORRAL', grupo: 'MBG', peso: 30 },
      { perfil: 'TRASPATIO', grupo: 'MBA', peso: 60 },
      { perfil: 'TRASPATIO', grupo: 'MBR', peso: 40 },
      { perfil: 'TRASPATIO', grupo: 'MBG', peso: 0 },
    ];
    for (const peso of pesos) {
      await queryRunner.query(
        `INSERT INTO "peso_grupo" ("metodologia_id", "perfil", "grupo", "peso") VALUES ($1, $2, $3, $4)`,
        [metodologiaId, peso.perfil, peso.grupo, peso.peso],
      );
    }

    const indicadores = catalogoProvisional();
    for (const indicador of indicadores) {
      await queryRunner.query(
        `INSERT INTO "indicador" ("metodologia_id", "grupo", "codigo", "nombre", "orden", "escala_min", "escala_max", "grupos_productivos") ` +
          `VALUES ($1, $2, $3, $4, $5, 0, 2, ARRAY['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA']::text[])`,
        [
          metodologiaId,
          indicador.grupo,
          indicador.codigo,
          indicador.nombre,
          indicador.orden,
        ],
      );
    }
  }
}

/** Indicadores provisionales: MBR y MBG salen del wireframe; MBA, sin nombre. */
function catalogoProvisional(): {
  grupo: string;
  codigo: string;
  nombre: string;
  orden: number;
}[] {
  const mbr = [
    'Partículas en el aire',
    'Calidad de la cama',
    'Bebederos',
    'Suministro de agua',
    'Animales por bebedero',
    'Comederos',
    'Confort térmico',
    'Nidal',
    'Espacio disponible',
  ];
  const mbg = [
    'Calidad del agua',
    'Alimentación equilibrada',
    'Vigilancia sanitaria',
    'POE de bienestar animal',
    'Condiciones térmicas',
    'Programa de iluminación',
    'Capacitación en bienestar animal',
    'Protocolo de eutanasia',
    'Mortalidad (5 ciclos)',
    'Uso de medicamentos',
  ];

  return [
    ...mbr.map((nombre, indice) => ({
      grupo: 'MBR',
      codigo: `MBR-${String(indice + 1).padStart(2, '0')}`,
      nombre,
      orden: indice + 1,
    })),
    // Los diez indicadores del animal no aparecen con nombre en los documentos
    // fuente: quedan como marcadores de posición hasta tener el manual.
    ...Array.from({ length: 10 }, (_, indice) => ({
      grupo: 'MBA',
      codigo: `MBA-${String(indice + 1).padStart(2, '0')}`,
      nombre: `Indicador del animal ${indice + 1} (nombre por confirmar)`,
      orden: indice + 1,
    })),
    ...mbg.map((nombre, indice) => ({
      grupo: 'MBG',
      codigo: `MBG-${String(indice + 1).padStart(2, '0')}`,
      nombre,
      orden: indice + 1,
    })),
  ];
}
