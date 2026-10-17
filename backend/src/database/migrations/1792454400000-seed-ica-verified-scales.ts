import type { MigrationInterface, QueryRunner } from 'typeorm';

type Escala = Record<'0' | '1' | '2', string>;

const NO_APLICA = '[NO_APLICA] No definido por la escala ICA; se asignan únicamente 0 y 2.';
const tri = (dos: string, uno: string, cero: string): Escala => ({
  '0': cero,
  '1': uno,
  '2': dos,
});
const bin = (dos: string, cero: string): Escala => ({
  '0': cero,
  '1': NO_APLICA,
  '2': dos,
});

const ESCALAS: Record<string, Escala> = {
  CORRAL_PARTICULAS_AIRE: tri('El dedo queda limpio o con polvo mínimo.', 'Hay polvo, pero se retira fácilmente.', 'El dedo queda muy cubierto de polvo difícil de retirar.'),
  CORRAL_CALIDAD_CAMA: tri('La cama no se compacta o se desmorona con facilidad.', 'La cama se compacta ligeramente por humedad.', 'La cama está muy compacta por humedad o no se puede tomar una muestra.'),
  CORRAL_INTEGRIDAD_JAULA: tri('Altura permite postura erguida; jaula limpia, íntegra y sin salientes lesivos.', 'Altura suficiente, pero la jaula está sucia o presenta daños.', 'Altura insuficiente que impide la postura erguida, sin importar otras condiciones.'),
  CORRAL_CALIDAD_BEBEDEROS: tri('Altura cómoda; bebedero íntegro y limpio, sin lama.', 'Altura cómoda, pero el bebedero está sucio o no íntegro.', 'Altura insuficiente para beber cómodamente, sin importar otras condiciones.'),
  CORRAL_SUMINISTRO_AGUA: tri('Pivote con presión y flujo constantes o bebedero de campana con llenado adecuado.', 'Presión o flujo fluctuantes, o llenado escaso por goteo.', 'Sin presión o flujo, o sin llenado del bebedero.'),
  CORRAL_ANIMALES_BEBEDERO: tri('Relación de aves por bebedero dentro del límite del fabricante o la línea genética.', 'Supera el límite hasta en 30%.', 'Supera el límite en más de 30%.'),
  CORRAL_TRATAMIENTO_AGUA: tri('Protocolo completo, registros de aplicación e infraestructura y recursos funcionales.', 'Recursos funcionales y registros, pero falta protocolo escrito o tiene requisitos incompletos.', 'Faltan recursos o infraestructura funcionales, o no hay registros de aplicación.'),
  CORRAL_CALIDAD_COMEDEROS: tri('Altura adecuada; comedero íntegro y limpio.', 'Altura adecuada, pero está deteriorado o sucio.', 'Altura insuficiente para alimentarse cómodamente, independientemente de lo demás.'),
  CORRAL_ANIMALES_COMEDERO: tri('Relación de aves por comedero dentro del límite del fabricante o la línea genética.', 'Supera el límite hasta en 30%.', 'Supera el límite en más de 30%.'),
  CORRAL_CONFORT_TERMICO: tri('Infraestructura, equipos e insumos funcionales, declarados en el POE; soportes de electrolitos cuando se suministren.', 'Recursos funcionales, pero no declarados en el POE o faltan soportes/registros de electrolitos.', 'No existen recursos de confort térmico o no son funcionales.'),
  CORRAL_NIDAL: tri('Nidal íntegro; con perchas y cama cuando correspondan.', 'Nidal funcional, aunque con condiciones no ideales de cama, antigüedad o aislamiento visual.', 'Nidal no funcional, fracturado o sin condiciones estructurales requeridas.'),
  CORRAL_ESPACIO_JAULA: bin('Espacio por ave: producción ≥450 cm²; levante ≥300 cm²; recibimiento/cría ≥200 cm².', 'Espacio por ave inferior al umbral de la etapa productiva.'),
  CORRAL_ESPACIO_PISO: bin('Densidad: producción ≤11 aves/m²; levante ≤15; recibimiento/cría ≤60; pastoreo ≤4.', 'Densidad por encima del umbral aplicable; sin soportes documentales se asigna 0.'),
  CORRAL_ESPACIO_POLLO: bin('Densidad dentro del límite del sistema: abierto ≤33; abierto mecanizado ≤36; túnel ≤39; ambiente controlado ≤44 kg/m².', 'Densidad sobre el límite del sistema o sin soportes documentales.'),
  CORRAL_JADEO: tri('Hasta 40% de aves con jadeo.', 'Más de 40% y hasta 60% con jadeo.', 'Más de 60% con jadeo.'),
  CORRAL_AMONTONAMIENTO: tri('Hasta 40% de aves amontonadas.', 'Más de 40% y hasta 60% amontonadas.', 'Más de 60% amontonadas.'),
  CORRAL_QUILLA: tri('Quilla recta, sin alteraciones visibles ni palpables.', 'Inicio de desviación, fractura o callosidad.', 'Desviación evidente visual o a la palpación.'),
  CORRAL_PODODERMATITIS: tri('Sin inflamación, lesiones ni dolor en almohadilla plantar o zonas adyacentes.', 'Daño leve o herida sin señales evidentes de dolor.', 'Daño severo, inflamación marcada o dolor evidente.'),
  CORRAL_DANO_DEDOS: tri('Sin anormalidad ni pérdida de integridad en los dedos.', 'Herida, inflamación, amputación o daño ungueal sin dolor evidente.', 'Lesión o pérdida de tejido con señales de dolor.'),
  CORRAL_LESIONES_CORVEJONES: tri('Sin lesión o con lesión muy pequeña y sin dolor.', 'Lesión activa mayor, no oscura y sin dolor evidente.', 'Necrosis, lesión oscurecida persistente o inflamación/dolor evidentes.'),
  CORRAL_LESIONES_PIEL: tri('Sin lesiones relevantes, hasta dos rasguños pequeños y sin prolapso.', 'Lesiones de 0,5 a 2 cm o tres o más rasguños pequeños, sin prolapso.', 'Lesión de 2 cm o más, o prolapso cloacal.'),
  CORRAL_PLUMAJE: tri('Plumaje homogéneo en dorso y vientre; variación natural por estirpe.', 'Alteración de color en una región o pequeñas adhesiones de cama/excremento.', 'Alteración general del plumaje, suciedad extendida o dermatitis/tejido necrosado.'),
  CORRAL_INTEGRIDAD_OCULO_NASAL: tri('Sin descargas, lesiones ni carnosidades oculares.', 'Descarga nasal u ocular, sin lesión ni carnosidades.', 'Descargas nasal y ocular, carnosidades o lesiones agudas/crónicas.'),
  CORRAL_CONDICION_PICO: tri('Sin corrección o corrección menor a un tercio, sin bordes irregulares ni dolor.', 'Corrección menor a un tercio con bordes irregulares, sin dolor.', 'Corrección mayor a dos tercios, dolor o bordes cortantes.'),
  CORRAL_MORTALIDAD: tri('Mortalidad acumulada ≤12% en ponedoras o ≤6% en pollo de engorde.', 'Ponedoras >12–14% o pollo >6–9%; se documentan medidas correctivas ante desviaciones.', 'Mortalidad acumulada >14% en ponedoras o >9% en pollo de engorde.'),
  CORRAL_CALIDAD_AGUA: bin('Análisis fisicoquímico y microbiológico vigente por fuente, de laboratorio autorizado; acciones correctivas ante resultados no conformes.', 'Falta el análisis por fuente, está vencido/sin formalidades o no hay correcciones documentadas.'),
  CORRAL_ALIMENTACION_EQUILIBRADA: bin('Soportes del alimento adecuados a la etapa y procedentes de planta registrada ante ICA.', 'No hay soporte de que el alimento corresponde a la etapa fisiológica.'),
  CORRAL_VIGILANCIA_SANITARIA: bin('Certificación GAB y plan/procedimiento para enfermedades de control oficial.', 'Falta certificación GAB o el plan/procedimiento sanitario requerido.'),
  CORRAL_POE_BIENESTAR: bin('POE con vacunación, densidades, manejo de enfermos y reducción del dolor; firmado por profesional habilitado.', 'Falta el contenido mínimo o la firma profesional vigente.'),
  CORRAL_EMERGENCIAS_TERMICAS: bin('Protocolo de respuesta con procedimientos, equipos/insumos y firma/matrícula profesional vigentes.', 'No existe protocolo o no cumple los requisitos descritos.'),
  CORRAL_ILUMINACION: bin('Programa luz/oscuridad de 24 h y protocolo ante cambios abruptos, con estrategia y firma profesional vigente.', 'No hay evidencia del programa de luz/oscuridad o del protocolo de contingencia.'),
  CORRAL_CAPACITACION_BIENESTAR: bin('Todo el personal tiene certificado de asistencia y aprobación expedido por entidad/profesional reconocido por ICA.', 'Falta evidencia, no está certificado todo el personal o el emisor no es reconocido.'),
  CORRAL_SACRIFICIO_HUMANITARIO: bin('Protocolo con método, criterios y ficha técnica, basado en OMSA y firmado por MV/MVZ con matrícula vigente.', 'No existe protocolo, falta firma profesional válida o no se basa en lineamientos OMSA.'),
  CORRAL_CAPACITACION_SACRIFICIO: bin('Personal responsable certificado; o eutanasia a cargo de MV/MVZ con matrícula vigente.', 'Falta evidencia de capacitación o el MV/MVZ responsable no tiene matrícula vigente.'),
  CORRAL_MEDICAMENTOS: tri('Cumple todas las BPUMV y cuenta con certificación GAB.', 'Cuenta con GAB, medicamentos con registro ICA y prescripción profesional, registros y productos vigentes.', 'Medicamentos sin registro o vencidos, sustancias prohibidas, falta de prescripción/registros o de GAB.'),
  TRASPATIO_PARTICULAS_AIRE: tri('Sin corral: puntaje 2; con corral, dedo limpio o con polvo mínimo.', 'Con corral, dedo con polvo fácil de retirar.', 'Con corral, dedo muy saturado de polvo difícil de retirar.'),
  TRASPATIO_CALIDAD_CAMA: tri('Material suelto/granuloso que no se compacta o se desmorona.', 'Compactación ligera por humedad.', 'Cama muy compacta por humedad o muestra imposible de tomar.'),
  TRASPATIO_BEBEDEROS_AGUA: tri('Altura cómoda, bebedero íntegro/sin lama, agua suficiente y limpia; sombra fuera del corral.', 'Altura cómoda, pero sucio o deteriorado, agua insuficiente o exposición al sol.', 'Altura insuficiente o falta de agua; también aplica si no hay bebederos.'),
  TRASPATIO_CALIDAD_COMEDEROS: tri('Altura cómoda; comedero íntegro y limpio.', 'Altura cómoda, pero deteriorado, sucio o expuesto al sol.', 'Altura insuficiente para alimentarse cómodamente.'),
  TRASPATIO_CONFORT_TERMICO: tri('Infraestructura/equipos existen y funcionan.', 'Infraestructura/equipos existen, pero no funcionan.', 'No hay infraestructura que garantice confort térmico.'),
  TRASPATIO_NIDAL: tri('Nidales íntegros y funcionales, con perchas/cama cuando correspondan.', 'Nidales funcionales con condiciones no ideales.', 'Nidales no íntegros, fracturados sin aislamiento o inexistentes.'),
  TRASPATIO_ESPACIO_PONEDORAS: bin('Hasta 4 aves/m².', 'Más de 4 aves/m².'),
  TRASPATIO_ESPACIO_POLLO: bin('Hasta 33 kg/m².', 'Más de 33 kg/m².'),
  TRASPATIO_ALOJAMIENTO: tri('Cuenta con corral que protege de depredadores e intemperie.', 'Cuenta con instalación de resguardo.', 'No cuenta con instalación de resguardo para las aves.'),
  TRASPATIO_JADEO: tri('Hasta 40% de aves con jadeo.', 'Más de 40% y hasta 60% con jadeo.', 'Más de 60% con jadeo.'),
  TRASPATIO_AMONTONAMIENTO: tri('Hasta 40% de aves amontonadas.', 'Más de 40% y hasta 60% amontonadas.', 'Más de 60% amontonadas.'),
  TRASPATIO_QUILLA: tri('Quilla recta, sin alteraciones visibles ni palpables.', 'Inicio de desviación, fractura o callosidad.', 'Desviación evidente visual o a la palpación.'),
  TRASPATIO_PODODERMATITIS: tri('Sin inflamación, lesión ni dolor en almohadilla plantar o zonas adyacentes.', 'Daño leve sin señales evidentes de dolor.', 'Daño severo, inflamación marcada o dolor evidente.'),
  TRASPATIO_DANO_DEDOS: tri('Sin anormalidad ni pérdida de integridad en los dedos.', 'Herida, inflamación, amputación o daño ungueal sin dolor evidente.', 'Lesión o pérdida de tejido con señales de dolor.'),
  TRASPATIO_LESIONES_CORVEJONES: tri('Sin lesión o con lesión muy pequeña y sin dolor.', 'Lesión activa mayor, no oscura y sin dolor evidente.', 'Necrosis, lesión oscurecida persistente o inflamación/dolor evidentes.'),
  TRASPATIO_LESIONES_PIEL: tri('Sin lesiones relevantes, hasta dos rasguños pequeños y sin prolapso.', 'Lesiones de 0,5 a 2 cm o tres o más rasguños pequeños, sin prolapso.', 'Lesión de 2 cm o más, o prolapso cloacal.'),
  TRASPATIO_PLUMAJE: tri('Plumaje homogéneo en dorso y vientre; variación natural por estirpe.', 'Alteración de color en una región o pequeñas adhesiones de cama/excremento.', 'Alteración general, suciedad extendida o dermatitis/tejido necrosado.'),
  TRASPATIO_INTEGRIDAD_OCULO_NASAL: tri('Sin descargas, lesiones ni carnosidades oculares.', 'Descarga nasal u ocular, sin lesión ni carnosidades.', 'Descargas nasal y ocular, carnosidades o lesiones agudas/crónicas.'),
  TRASPATIO_CONDICION_PICO: tri('Sin corrección o corrección menor a un tercio, sin bordes irregulares ni dolor.', 'Corrección menor a un tercio con bordes irregulares, sin dolor.', 'Corrección mayor a dos tercios, dolor o bordes cortantes.'),
  TRASPATIO_CONDICION_CORPORAL: tri('Gallina: condición 2–3. Pollo: condición 3–4.', 'Gallina: condición 4. Pollo: condición 2.', 'Gallina: condición 1 o 5. Pollo: condición 1 o 5.'),
};

export class SeedIcaVerifiedScales1792454400000 implements MigrationInterface {
  name = 'SeedIcaVerifiedScales1792454400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const versiones = (await queryRunner.query(
      `SELECT "id", "nombre" FROM "metodologia_version" WHERE "activa" = true FOR UPDATE`,
    )) as Array<{ id: string; nombre: string }>;
    if (versiones.length !== 1) throw new Error('Se esperaba una única versión metodológica activa.');
    const anterior = versiones[0];
    const filas = (await queryRunner.query(
      `SELECT "clave", "nombre", "grupo_medida", "metodo_evaluacion", "grupos_productivos",
              "referencia_manual", "activo"
       FROM "indicador_metodologia" WHERE "version_id" = $1 ORDER BY "clave"`,
      [anterior.id],
    )) as Array<{
      clave: string;
      nombre: string;
      grupo_medida: string;
      metodo_evaluacion: string;
      grupos_productivos: string[];
      referencia_manual: string;
      activo: boolean;
    }>;
    if (filas.length !== Object.keys(ESCALAS).length || filas.some((fila) => !ESCALAS[fila.clave])) {
      throw new Error('El catálogo activo no coincide con las 55 escalas cotejadas del manual ICA.');
    }

    const [nueva] = (await queryRunner.query(
      `INSERT INTO "metodologia_version" ("nombre", "notas", "activa")
       VALUES ('2.0-2024-ICA-transcrita',
               'Versión derivada con criterios de escala cotejados y resumidos desde el manual ICA EBA v2.0 (2024); las escalas binarias conservan el puntaje intermedio como no aplicable. No modifica actas ni snapshots anteriores.',
               false)
       RETURNING "id"`,
    )) as Array<{ id: string }>;
    await queryRunner.query(
      `INSERT INTO "peso_grupo" ("version_id", "tipo_predio", "grupo_medida", "porcentaje")
       SELECT $1, "tipo_predio", "grupo_medida", "porcentaje"
       FROM "peso_grupo" WHERE "version_id" = $2`,
      [nueva.id, anterior.id],
    );
    for (const fila of filas) {
      await queryRunner.query(
        `INSERT INTO "indicador_metodologia"
         ("version_id", "clave", "nombre", "grupo_medida", "metodo_evaluacion",
          "grupos_productivos", "referencia_manual", "escala_puntaje", "activo")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          nueva.id,
          fila.clave,
          fila.nombre,
          fila.grupo_medida,
          fila.metodo_evaluacion,
          fila.grupos_productivos,
          fila.referencia_manual,
          JSON.stringify(ESCALAS[fila.clave]),
          fila.activo,
        ],
      );
    }
    await queryRunner.query(`UPDATE "metodologia_version" SET "activa" = false WHERE "id" = $1`, [anterior.id]);
    await queryRunner.query(`UPDATE "metodologia_version" SET "activa" = true WHERE "id" = $1`, [nueva.id]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const filas = (await queryRunner.query(
      `SELECT "id" FROM "metodologia_version" WHERE "nombre" = '2.0-2024-ICA-transcrita'`,
    )) as Array<{ id: string }>;
    if (!filas.length) return;
    const id = filas[0].id;
    const actas = (await queryRunner.query(
      `SELECT 1 FROM "acta_visita" WHERE "metodologia_version_id" = $1 LIMIT 1`,
      [id],
    )) as unknown[];
    if (actas.length) {
      throw new Error('No se puede revertir esta versión: existen actas que la conservan como snapshot.');
    }
    await queryRunner.query(`UPDATE "metodologia_version" SET "activa" = false WHERE "id" = $1`, [id]);
    await queryRunner.query(
      `UPDATE "metodologia_version" SET "activa" = true
       WHERE "created_at" = (SELECT MAX("created_at") FROM "metodologia_version" WHERE "id" <> $1)`,
      [id],
    );
    await queryRunner.query(`DELETE FROM "indicador_metodologia" WHERE "version_id" = $1`, [id]);
    await queryRunner.query(`DELETE FROM "peso_grupo" WHERE "version_id" = $1`, [id]);
    await queryRunner.query(`DELETE FROM "metodologia_version" WHERE "id" = $1`, [id]);
  }
}
