import type { MigrationInterface, QueryRunner } from 'typeorm';

type IndicadorSemilla = {
  clave: string;
  nombre: string;
  grupo: 'MBA' | 'MBR' | 'MBG';
  metodo: string;
  productivos: string[];
  pagina: number;
};

const PONEDORAS_CORRAL = ['PONEDORA_JAULA', 'PONEDORA_PISO_PASTOREO'];
const TODAS_CORRAL = [...PONEDORAS_CORRAL, 'POLLO_ENGORDE'];
const TODAS_TRASPATIO = ['TRASPATIO_PONEDORA', 'TRASPATIO_POLLO'];
const AVES_TRASPATIO = [...TODAS_TRASPATIO];

const INDICADORES: IndicadorSemilla[] = [
  { clave: 'CORRAL_PARTICULAS_AIRE', nombre: 'Medición de partículas suspendidas en el aire', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 16 },
  { clave: 'CORRAL_CALIDAD_CAMA', nombre: 'Calidad de la cama', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: ['PONEDORA_PISO_PASTOREO', 'POLLO_ENGORDE'], pagina: 16 },
  { clave: 'CORRAL_INTEGRIDAD_JAULA', nombre: 'Integridad de la jaula', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: ['PONEDORA_JAULA'], pagina: 17 },
  { clave: 'CORRAL_CALIDAD_BEBEDEROS', nombre: 'Calidad de los bebederos', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 17 },
  { clave: 'CORRAL_SUMINISTRO_AGUA', nombre: 'Suministro de agua en los bebederos', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 18 },
  { clave: 'CORRAL_ANIMALES_BEBEDERO', nombre: 'Animales por bebedero', grupo: 'MBR', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 19 },
  { clave: 'CORRAL_TRATAMIENTO_AGUA', nombre: 'Tratamiento del agua', grupo: 'MBR', metodo: 'Inspección visual sin muestreo y documental', productivos: TODAS_CORRAL, pagina: 19 },
  { clave: 'CORRAL_CALIDAD_COMEDEROS', nombre: 'Calidad de los comederos', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 20 },
  { clave: 'CORRAL_ANIMALES_COMEDERO', nombre: 'Animales por comedero', grupo: 'MBR', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 21 },
  { clave: 'CORRAL_CONFORT_TERMICO', nombre: 'Medios para contribuir al confort térmico', grupo: 'MBR', metodo: 'Inspección visual sin muestreo y documental', productivos: TODAS_CORRAL, pagina: 21 },
  { clave: 'CORRAL_NIDAL', nombre: 'Calidad, integridad y funcionalidad del nidal', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: ['PONEDORA_PISO_PASTOREO'], pagina: 21 },
  { clave: 'CORRAL_ESPACIO_JAULA', nombre: 'Espacio disponible para ponedoras en jaula', grupo: 'MBR', metodo: 'Inspección visual con muestreo y documental', productivos: ['PONEDORA_JAULA'], pagina: 22 },
  { clave: 'CORRAL_ESPACIO_PISO', nombre: 'Espacio disponible en ponedoras en piso y pastoreo', grupo: 'MBR', metodo: 'Inspección documental', productivos: ['PONEDORA_PISO_PASTOREO'], pagina: 23 },
  { clave: 'CORRAL_ESPACIO_POLLO', nombre: 'Espacio disponible en pollo de engorde', grupo: 'MBR', metodo: 'Inspección documental y/o visual con muestreo', productivos: ['POLLO_ENGORDE'], pagina: 24 },
  { clave: 'CORRAL_JADEO', nombre: 'Jadeo', grupo: 'MBA', metodo: 'Inspección visual sin muestreo', productivos: TODAS_CORRAL, pagina: 25 },
  { clave: 'CORRAL_AMONTONAMIENTO', nombre: 'Acurrucarse en grupos (amontonamiento)', grupo: 'MBA', metodo: 'Inspección visual sin muestreo', productivos: TODAS_CORRAL, pagina: 26 },
  { clave: 'CORRAL_QUILLA', nombre: 'Integridad del hueso de la quilla', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: PONEDORAS_CORRAL, pagina: 26 },
  { clave: 'CORRAL_PODODERMATITIS', nombre: 'Podo dermatitis', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 27 },
  { clave: 'CORRAL_DANO_DEDOS', nombre: 'Daño en los dedos', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 28 },
  { clave: 'CORRAL_LESIONES_CORVEJONES', nombre: 'Lesiones en corvejones', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: ['POLLO_ENGORDE'], pagina: 28 },
  { clave: 'CORRAL_LESIONES_PIEL', nombre: 'Lesiones en piel y/u otros tegumentos', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 29 },
  { clave: 'CORRAL_PLUMAJE', nombre: 'Suciedad y apariencia del plumaje', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 30 },
  { clave: 'CORRAL_INTEGRIDAD_OCULO_NASAL', nombre: 'Integridad óculo-nasal', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: TODAS_CORRAL, pagina: 30 },
  { clave: 'CORRAL_CONDICION_PICO', nombre: 'Condición del pico', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: PONEDORAS_CORRAL, pagina: 31 },
  { clave: 'CORRAL_MORTALIDAD', nombre: 'Mortalidad', grupo: 'MBA', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 31 },
  { clave: 'CORRAL_CALIDAD_AGUA', nombre: 'Calidad del agua', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 32 },
  { clave: 'CORRAL_ALIMENTACION_EQUILIBRADA', nombre: 'Alimentación equilibrada', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 32 },
  { clave: 'CORRAL_VIGILANCIA_SANITARIA', nombre: 'Programas de vigilancia y gestión sanitaria', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 33 },
  { clave: 'CORRAL_POE_BIENESTAR', nombre: 'POE de bienestar animal', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 33 },
  { clave: 'CORRAL_EMERGENCIAS_TERMICAS', nombre: 'Condiciones térmicas diarias y manejo de emergencias', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 34 },
  { clave: 'CORRAL_ILUMINACION', nombre: 'Programa de iluminación', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 35 },
  { clave: 'CORRAL_CAPACITACION_BIENESTAR', nombre: 'Capacitación básica en bienestar animal', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 36 },
  { clave: 'CORRAL_SACRIFICIO_HUMANITARIO', nombre: 'Protocolo de sacrificio humanitario o eutanasia', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 36 },
  { clave: 'CORRAL_CAPACITACION_SACRIFICIO', nombre: 'Capacitación en sacrificio humanitario o eutanasia', grupo: 'MBG', metodo: 'Inspección documental', productivos: TODAS_CORRAL, pagina: 37 },
  { clave: 'CORRAL_MEDICAMENTOS', nombre: 'Uso responsable de medicamentos e insumos veterinarios', grupo: 'MBG', metodo: 'Inspección documental y visual', productivos: TODAS_CORRAL, pagina: 38 },
  { clave: 'TRASPATIO_PARTICULAS_AIRE', nombre: 'Medición de partículas suspendidas en el aire', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 40 },
  { clave: 'TRASPATIO_CALIDAD_CAMA', nombre: 'Calidad de la cama', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 41 },
  { clave: 'TRASPATIO_BEBEDEROS_AGUA', nombre: 'Calidad de los bebederos y suministro de agua', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 41 },
  { clave: 'TRASPATIO_CALIDAD_COMEDEROS', nombre: 'Calidad de los comederos', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: ['TRASPATIO_PONEDORA'], pagina: 42 },
  { clave: 'TRASPATIO_CONFORT_TERMICO', nombre: 'Medios para contribuir al confort térmico', grupo: 'MBR', metodo: 'Inspección visual sin muestreo y documental', productivos: AVES_TRASPATIO, pagina: 43 },
  { clave: 'TRASPATIO_NIDAL', nombre: 'Calidad, integridad y funcionalidad del nidal', grupo: 'MBR', metodo: 'Inspección visual con muestreo', productivos: ['TRASPATIO_PONEDORA'], pagina: 44 },
  { clave: 'TRASPATIO_ESPACIO_PONEDORAS', nombre: 'Espacio disponible para ponedoras', grupo: 'MBR', metodo: 'Inspección documental', productivos: ['TRASPATIO_PONEDORA'], pagina: 44 },
  { clave: 'TRASPATIO_ESPACIO_POLLO', nombre: 'Espacio disponible para pollo de engorde', grupo: 'MBR', metodo: 'Inspección documental', productivos: ['TRASPATIO_POLLO'], pagina: 44 },
  { clave: 'TRASPATIO_ALOJAMIENTO', nombre: 'Lugar de alojamiento', grupo: 'MBR', metodo: 'Inspección visual sin muestreo', productivos: AVES_TRASPATIO, pagina: 45 },
  { clave: 'TRASPATIO_JADEO', nombre: 'Jadeo', grupo: 'MBA', metodo: 'Inspección visual sin muestreo', productivos: AVES_TRASPATIO, pagina: 45 },
  { clave: 'TRASPATIO_AMONTONAMIENTO', nombre: 'Acurrucarse en grupos (amontonamiento)', grupo: 'MBA', metodo: 'Inspección visual sin muestreo', productivos: AVES_TRASPATIO, pagina: 46 },
  { clave: 'TRASPATIO_QUILLA', nombre: 'Integridad del hueso de la quilla', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: ['TRASPATIO_PONEDORA'], pagina: 46 },
  { clave: 'TRASPATIO_PODODERMATITIS', nombre: 'Podo dermatitis', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 46 },
  { clave: 'TRASPATIO_DANO_DEDOS', nombre: 'Daño en los dedos', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 47 },
  { clave: 'TRASPATIO_LESIONES_CORVEJONES', nombre: 'Lesiones en corvejones', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: ['TRASPATIO_POLLO'], pagina: 48 },
  { clave: 'TRASPATIO_LESIONES_PIEL', nombre: 'Lesiones en piel y/u otros tegumentos', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 48 },
  { clave: 'TRASPATIO_PLUMAJE', nombre: 'Suciedad y apariencia del plumaje', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 49 },
  { clave: 'TRASPATIO_INTEGRIDAD_OCULO_NASAL', nombre: 'Integridad óculo-nasal', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 50 },
  { clave: 'TRASPATIO_CONDICION_PICO', nombre: 'Condición del pico', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: ['TRASPATIO_PONEDORA'], pagina: 50 },
  { clave: 'TRASPATIO_CONDICION_CORPORAL', nombre: 'Condición corporal', grupo: 'MBA', metodo: 'Inspección visual con muestreo', productivos: AVES_TRASPATIO, pagina: 51 },
];

export class CreateModulo7Modulo81792281600000 implements MigrationInterface {
  name = 'CreateModulo7Modulo81792281600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "metodologia_version" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(40) NOT NULL UNIQUE,
        "notas" text,
        "activa" boolean NOT NULL DEFAULT false,
        "creada_por" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "indicador_metodologia" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "version_id" uuid NOT NULL REFERENCES "metodologia_version"("id") ON DELETE RESTRICT,
        "clave" varchar(60) NOT NULL,
        "nombre" varchar(180) NOT NULL,
        "grupo_medida" varchar(3) NOT NULL CHECK ("grupo_medida" IN ('MBA', 'MBR', 'MBG')),
        "metodo_evaluacion" varchar(80) NOT NULL,
        "grupos_productivos" text[] NOT NULL,
        "referencia_manual" varchar(100) NOT NULL,
        "escala_puntaje" jsonb NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_indicador_version_clave" UNIQUE ("version_id", "clave")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "peso_grupo" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "version_id" uuid NOT NULL REFERENCES "metodologia_version"("id") ON DELETE RESTRICT,
        "tipo_predio" varchar(20) NOT NULL CHECK ("tipo_predio" IN ('CORRAL', 'TRASPATIO')),
        "grupo_medida" varchar(3) NOT NULL CHECK ("grupo_medida" IN ('MBA', 'MBR', 'MBG')),
        "porcentaje" numeric(5,2) NOT NULL CHECK ("porcentaje" BETWEEN 0 AND 100),
        CONSTRAINT "UQ_peso_version_predio_grupo" UNIQUE ("version_id", "tipo_predio", "grupo_medida")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "acta_visita" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "visita_id" uuid NOT NULL UNIQUE REFERENCES "visita"("id") ON DELETE RESTRICT,
        "metodologia_version_id" uuid NOT NULL REFERENCES "metodologia_version"("id") ON DELETE RESTRICT,
        "resultado_snapshot" jsonb NOT NULL,
        "catalogo_snapshot" jsonb NOT NULL,
        "documentos_pendientes" boolean NOT NULL DEFAULT false,
        "vence_documentos" timestamptz,
        "fecha_definitiva" timestamptz,
        "firmada_por" uuid NOT NULL REFERENCES "usuario"("id") ON DELETE RESTRICT,
        "correo_responsable" varchar(180),
        "pdf" bytea,
        "firma" bytea,
        "correo_enviado_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "auditoria_modulo" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid REFERENCES "usuario"("id") ON DELETE RESTRICT,
        "modulo" varchar(60) NOT NULL,
        "accion" varchar(60) NOT NULL,
        "recurso_id" uuid,
        "detalle" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_acta_visita_vence" ON "acta_visita" ("vence_documentos") WHERE "documentos_pendientes" = true`);
    await queryRunner.query(`CREATE INDEX "IDX_auditoria_modulo_actor" ON "auditoria_modulo" ("actor_id")`);

    const [version] = (await queryRunner.query(
      `INSERT INTO "metodologia_version" ("nombre", "notas", "activa") VALUES ('2.0-2024', 'Manual oficial EBA Aves de Corral, ICA, versión 2.0 (2024). Las descripciones deben contrastarse con la tabla de referencia del manual antes de su uso.', true) RETURNING "id"`,
    )) as Array<{ id: string }>;
    const pesos: Array<['CORRAL' | 'TRASPATIO', 'MBA' | 'MBR' | 'MBG', number]> = [
      ['CORRAL', 'MBA', 35], ['CORRAL', 'MBR', 35], ['CORRAL', 'MBG', 30],
      ['TRASPATIO', 'MBA', 60], ['TRASPATIO', 'MBR', 40], ['TRASPATIO', 'MBG', 0],
    ];
    for (const [tipoPredio, grupoMedida, porcentaje] of pesos) {
      await queryRunner.query(
        `INSERT INTO "peso_grupo" ("version_id", "tipo_predio", "grupo_medida", "porcentaje") VALUES ($1, $2, $3, $4)`,
        [version.id, tipoPredio, grupoMedida, porcentaje],
      );
    }
    for (const indicador of INDICADORES) {
      const escala = {
        '0': `Puntaje 0. Consultar criterio oficial de la tabla correspondiente (ICA EBA v2.0, p. ${indicador.pagina}).`,
        '1': `Puntaje 1. Consultar criterio oficial de la tabla correspondiente (ICA EBA v2.0, p. ${indicador.pagina}).`,
        '2': `Puntaje 2. Consultar criterio oficial de la tabla correspondiente (ICA EBA v2.0, p. ${indicador.pagina}).`,
      };
      await queryRunner.query(
        `INSERT INTO "indicador_metodologia" ("version_id", "clave", "nombre", "grupo_medida", "metodo_evaluacion", "grupos_productivos", "referencia_manual", "escala_puntaje") VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          version.id,
          indicador.clave,
          indicador.nombre,
          indicador.grupo,
          indicador.metodo,
          indicador.productivos,
          `ICA EBA v2.0 (2024), página ${indicador.pagina}`,
          JSON.stringify(escala),
        ],
      );
    }
    await queryRunner.query(`UPDATE "app_metadata" SET "value" = '4' WHERE "key" = 'schema_version'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auditoria_modulo"`);
    await queryRunner.query(`DROP TABLE "acta_visita"`);
    await queryRunner.query(`DROP TABLE "peso_grupo"`);
    await queryRunner.query(`DROP TABLE "indicador_metodologia"`);
    await queryRunner.query(`DROP TABLE "metodologia_version"`);
    await queryRunner.query(`UPDATE "app_metadata" SET "value" = '3' WHERE "key" = 'schema_version'`);
  }
}
