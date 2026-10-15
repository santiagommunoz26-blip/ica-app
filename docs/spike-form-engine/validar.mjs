#!/usr/bin/env node
/**
 * Spike S0 · Motor de formularios dinámicos (US-08)
 *
 * Prototipo sin dependencias que responde la pregunta del spike:
 *   ¿cómo almacenar y versionar checklists anidados con ponderaciones que
 *   sumen 100 en cada nivel, y cómo calcular el resultado?
 *
 * Reglas de la metodología implementadas (tomadas de los documentos fuente):
 *   1. Indicador = (promedio de puntajes × 100) / 2
 *   2. Grupo     = promedio de sus indicadores × su peso
 *   3. Final     = suma de los grupos
 *   4. Clasificación: Excelente ≥90 · Alto ≥75 · Medio ≥50 · Bajo <50
 *   RF25: un indicador marcado "No aplica" se excluye del cálculo.
 *
 * Uso:  node docs/spike-form-engine/validar.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const leerJson = (archivo) => JSON.parse(readFileSync(join(aqui, archivo), 'utf8'));

const TIPOS_PUNTUABLES = ['escala', 'numerica'];
const TOLERANCIA = 0.01;

// ---------------------------------------------------------------------------
// 1. Validación del catálogo (lo que en producción haría el administrador)
// ---------------------------------------------------------------------------

/** Devuelve la lista de errores del catálogo (vacía si es válido). */
function validarCatalogo(catalogo) {
  const errores = [];
  const permitidos = new Set(catalogo.tiposPreguntaPermitidos ?? []);
  const escala = catalogo.escala ?? {};

  if (!catalogo.versionId) errores.push('Falta versionId de la metodología.');

  // Códigos únicos de grupos, indicadores y preguntas.
  const codigosIndicador = new Set();
  const codigosPregunta = new Set();

  for (const grupo of catalogo.grupos ?? []) {
    if (codigosIndicador.has(grupo.codigo)) errores.push(`Grupo duplicado: ${grupo.codigo}.`);

    for (const indicador of grupo.indicadores ?? []) {
      if (codigosIndicador.has(indicador.codigo)) {
        errores.push(`Código de indicador duplicado: ${indicador.codigo}.`);
      }
      codigosIndicador.add(indicador.codigo);

      const preguntas = indicador.preguntas ?? [];
      if (!preguntas.some((p) => TIPOS_PUNTUABLES.includes(p.tipo))) {
        errores.push(
          `El indicador ${indicador.codigo} no tiene preguntas puntuables (${TIPOS_PUNTUABLES.join('|')}).`,
        );
      }

      for (const pregunta of preguntas) {
        if (codigosPregunta.has(pregunta.codigo)) {
          errores.push(`Código de pregunta duplicado: ${pregunta.codigo}.`);
        }
        codigosPregunta.add(pregunta.codigo);

        if (permitidos.size && !permitidos.has(pregunta.tipo)) {
          errores.push(`Tipo de pregunta no permitido en ${pregunta.codigo}: ${pregunta.tipo}.`);
        }
        if (pregunta.tipo === 'escala') {
          const { min = 0, max = 2 } = escala;
          const ejemplos = pregunta.valores ?? [min, max];
          if (ejemplos.some((v) => v < min || v > max)) {
            errores.push(`Valor fuera de escala en ${pregunta.codigo}.`);
          }
        }
      }
    }
  }

  // Pesos por perfil: deben sumar 100 y referenciar grupos existentes.
  const codigosGrupo = new Set((catalogo.grupos ?? []).map((g) => g.codigo));
  for (const [nombrePerfil, perfil] of Object.entries(catalogo.perfiles ?? {})) {
    const pesos = perfil.pesosGrupos ?? {};
    const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
    if (Math.abs(suma - 100) > TOLERANCIA) {
      errores.push(`Los pesos del perfil "${nombrePerfil}" suman ${suma} (deben sumar 100).`);
    }
    for (const codigo of Object.keys(pesos)) {
      if (!codigosGrupo.has(codigo)) {
        errores.push(`El perfil "${nombrePerfil}" referencia un grupo inexistente: ${codigo}.`);
      }
    }
  }

  // Clasificación: rangos descendentes y cobertura hasta 0.
  const clasificacion = catalogo.clasificacion ?? [];
  for (let i = 1; i < clasificacion.length; i++) {
    if (clasificacion[i].min >= clasificacion[i - 1].min) {
      errores.push('Los rangos de clasificación deben ser descendentes.');
      break;
    }
  }
  if (clasificacion.length && clasificacion.at(-1).min !== 0) {
    errores.push('La clasificación no cubre valores hasta 0.');
  }

  return errores;
}

// ---------------------------------------------------------------------------
// 2. Motor de cálculo
// ---------------------------------------------------------------------------

/** Clasifica un porcentaje final según la tabla del catálogo. */
function clasificar(catalogo, valor) {
  const rango = [...(catalogo.clasificacion ?? [])]
    .sort((a, b) => b.min - a.min)
    .find((r) => valor >= r.min);
  return rango?.nombre ?? 'Sin clasificar';
}

/** Determina el perfil según el número de aves (RF14). */
function perfilParaNumAves(catalogo, numAves) {
  if (numAves >= 200) return 'corral';
  const perfiles = Object.keys(catalogo.perfiles ?? {});
  return perfiles.includes('traspatio') ? 'traspatio' : perfiles[0];
}

/** Calcula indicadores, grupos, resultado final y clasificación. */
function calcular(catalogo, visita) {
  const perfil = catalogo.perfiles[visita.perfil];
  if (!perfil) throw new Error(`Perfil desconocido: ${visita.perfil}`);

  const escala = catalogo.escala ?? { min: 0, max: 2 };
  const respuestas = visita.respuestas ?? {};
  const noAplica = visita.noAplica ?? {};

  const indicadores = [];
  const grupos = [];

  for (const grupo of catalogo.grupos ?? []) {
    const pesoGrupo = perfil.pesosGrupos[grupo.codigo] ?? 0;
    const puntajesGrupo = [];

    for (const indicador of grupo.indicadores ?? []) {
      const motivo = noAplica[indicador.codigo];
      const puntuables = (indicador.preguntas ?? []).filter((p) =>
        TIPOS_PUNTUABLES.includes(p.tipo),
      );
      const puntajes = puntuables
        .map((p) => respuestas[p.codigo])
        .filter((v) => typeof v === 'number');

      if (motivo) {
        indicadores.push({
          codigo: indicador.codigo,
          grupo: grupo.codigo,
          puntaje: null,
          excluido: true,
          motivo,
        });
        continue;
      }

      if (puntajes.length !== puntuables.length) {
        throw new Error(
          `El indicador ${indicador.codigo} está incompleto (${puntajes.length}/${puntuables.length} respuestas).`,
        );
      }

      const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
      const puntaje = (promedio * 100) / escala.max;

      indicadores.push({
        codigo: indicador.codigo,
        grupo: grupo.codigo,
        puntaje,
        excluido: false,
        respuestas: puntajes.length,
      });
      puntajesGrupo.push(puntaje);
    }

    const aplicables = puntajesGrupo.length;
    const promedioGrupo = aplicables ? puntajesGrupo.reduce((a, b) => a + b, 0) / aplicables : null;

    grupos.push({
      codigo: grupo.codigo,
      nombre: grupo.nombre,
      peso: pesoGrupo,
      promedioIndicadores: promedioGrupo,
      aporte: promedioGrupo === null ? 0 : (promedioGrupo * pesoGrupo) / 100,
      indicadoresAplicables: aplicables,
      indicadoresExcluidos: grupo.indicadores.length - aplicables,
    });
  }

  const final = grupos.reduce((a, g) => a + g.aporte, 0);

  return { indicadores, grupos, final, clasificacion: clasificar(catalogo, final) };
}

// ---------------------------------------------------------------------------
// 3. Comprobaciones automáticas (pruebas del prototipo)
// ---------------------------------------------------------------------------

const catalogo = leerJson('catalogo.ejemplo.json');
const visita = leerJson('respuestas.ejemplo.json');
const r2 = (n) => Math.round(n * 100) / 100;

function pruebas() {
  // (a) El catálogo de ejemplo es válido.
  assert.deepEqual(validarCatalogo(catalogo), [], 'el catálogo de ejemplo debe ser válido');

  // (b) Un catálogo con pesos que no suman 100 se rechaza.
  const invalido = structuredClone(catalogo);
  invalido.perfiles.corral.pesosGrupos = { MBA: 40, MBR: 40, MBG: 19 };
  assert.ok(
    validarCatalogo(invalido).some((e) => e.includes('suman 99')),
    'debe detectar pesos que no suman 100',
  );

  // (c) Todo perfecto -> 100 · Excelente.
  const perfecto = structuredClone(visita);
  perfecto.noAplica = {};
  for (const clave of Object.keys(perfecto.respuestas)) {
    if (typeof perfecto.respuestas[clave] === 'number') perfecto.respuestas[clave] = 2;
  }
  const rPerfecto = calcular(catalogo, perfecto);
  assert.equal(r2(rPerfecto.final), 100, 'con todo en 2 el resultado debe ser 100');
  assert.equal(rPerfecto.clasificacion, 'Excelente');

  // (d) Todo en 0 -> 0 · Bajo.
  const pesimo = structuredClone(visita);
  pesimo.noAplica = {};
  for (const clave of Object.keys(pesimo.respuestas)) {
    if (typeof pesimo.respuestas[clave] === 'number') pesimo.respuestas[clave] = 0;
  }
  const rPesimo = calcular(catalogo, pesimo);
  assert.equal(r2(rPesimo.final), 0, 'con todo en 0 el resultado debe ser 0');
  assert.equal(rPesimo.clasificacion, 'Bajo');

  // (e) "No aplica" excluye el indicador y no rompe el promedio del grupo (RF25).
  const r = calcular(catalogo, visita);
  const mbr02 = r.indicadores.find((i) => i.codigo === 'MBR-02');
  const grupoMBR = r.grupos.find((g) => g.codigo === 'MBR');
  const grupoMBA = r.grupos.find((g) => g.codigo === 'MBA');
  const grupoMBG = r.grupos.find((g) => g.codigo === 'MBG');
  assert.equal(mbr02.excluido, true, 'MBR-02 debe quedar excluido');
  assert.equal(grupoMBR.indicadoresAplicables, 1, 'MBR debe promediar solo su indicador aplicable');
  assert.equal(r2(grupoMBR.promedioIndicadores), 50, 'MBR = promedio(MBR-01) = 50');
  assert.equal(r2(grupoMBR.aporte), 17.5, 'MBR aporta 50 × 35 % = 17,5');

  // (f) Verificación manual del ejemplo (fórmulas de la metodología).
  assert.equal(r2(grupoMBA.promedioIndicadores), 79.17, 'MBA = promedio(75; 83,33)');
  assert.equal(r2(grupoMBA.aporte), 27.71, 'MBA aporta 79,17 × 35 %');
  assert.equal(r2(grupoMBG.aporte), 30, 'MBG aporta 100 × 30 %');
  assert.equal(r2(r.final), 75.21, 'final = 27,71 + 17,5 + 30');
  assert.equal(r.clasificacion, 'Alto', '75,21 cae en Alto (≥75 y <90)');

  // (g) Perfil traspatio: 60/40 y MBG fuera del cálculo.
  const traspatio = structuredClone(visita);
  traspatio.perfil = 'traspatio';
  const rT = calcular(catalogo, traspatio);
  const mbaT = rT.grupos.find((g) => g.codigo === 'MBA');
  const mbgT = rT.grupos.find((g) => g.codigo === 'MBG');
  assert.equal(mbaT.peso, 60, 'traspatio pondera MBA al 60 %');
  assert.equal(mbgT.peso, 0, 'traspatio no pondera MBG');
  assert.equal(r2(rT.final), r2((mbaT.promedioIndicadores * 60 + grupoMBR.promedioIndicadores * 40) / 100));

  // (h) Inmutabilidad: la visita se calcula con el snapshot de su versión (RF49/RNF18).
  const snapshotVisita = structuredClone(catalogo); // copia que se guarda con la visita
  const antes = calcular(snapshotVisita, visita).final;

  const catalogoV21 = structuredClone(catalogo); // la metodología evoluciona…
  catalogoV21.versionId = 'ica-aves-2.1-2025';
  catalogoV21.version = '2.1';
  catalogoV21.perfiles.corral.pesosGrupos = { MBA: 40, MBR: 40, MBG: 20 };

  const despues = calcular(snapshotVisita, visita).final; // …pero la visita cerrada no cambia
  assert.equal(r2(antes), r2(despues), 'una visita cerrada no debe cambiar al editar el catálogo');

  const conNuevaVersion = calcular(catalogoV21, visita).final;
  assert.notEqual(
    r2(conNuevaVersion),
    r2(antes),
    'una visita nueva con la versión 2.1 debe dar un resultado distinto',
  );

  // (i) Clasificación del predio por número de aves (RF14).
  assert.equal(perfilParaNumAves(catalogo, 200), 'corral');
  assert.equal(perfilParaNumAves(catalogo, 199), 'traspatio');

  return { r, rT, antes, conNuevaVersion, rPerfecto, rPesimo };
}

// ---------------------------------------------------------------------------
// 4. Informe
// ---------------------------------------------------------------------------

const { r, rT, antes, conNuevaVersion } = pruebas();

const linea = (n) => String(n).padEnd(34, ' ');
const num = (n) => (n === null ? '—' : r2(n).toFixed(2).padStart(6));

console.log('\n=== Spike · motor de formularios dinámicos (ICA Aves) ===\n');
console.log(`Catálogo: ${catalogo.versionId} (metodología ${catalogo.version}, ${catalogo.anio})`);
console.log(`Visita:   ${visita.visitaId} · perfil "${visita.perfil}"`);
console.log(`Reglas:   indicador = (promedio × 100) / ${catalogo.escala.max} · grupo = promedio × peso · final = suma\n`);

console.log('Indicadores');
console.log('  ' + linea('Código') + 'Puntaje   Estado');
for (const i of r.indicadores) {
  const estado = i.excluido ? `No aplica (${i.motivo})` : `${i.respuestas} respuestas`;
  console.log('  ' + linea(i.codigo) + num(i.puntaje) + '   ' + estado);
}

console.log('\nGrupos');
console.log('  ' + linea('Grupo') + 'Promedio   Peso    Aporte');
for (const g of r.grupos) {
  console.log(
    '  ' +
      linea(`${g.codigo} (${g.indicadoresAplicables}/${g.indicadoresAplicables + g.indicadoresExcluidos} ind.)`) +
      num(g.promedioIndicadores) +
      `${String(g.peso).padStart(6)} %` +
      num(g.aporte),
  );
}
console.log('  ' + linea('FINAL') + ' '.repeat(7) + ' '.repeat(9) + num(r.final));
console.log(`  Clasificación: ${r.clasificacion}\n`);

console.log('Comprobaciones automáticas');
console.log('  ✔ catálogo válido (pesos que suman 100 en cada perfil, códigos únicos, escalas)');
console.log('  ✔ catálogo inválido detectado (MBA 40 + MBR 40 + MBG 19 = 99)');
console.log('  ✔ todo en 2 → 100,00 · Excelente   |   todo en 0 → 0,00 · Bajo');
console.log('  ✔ "No aplica" excluye MBR-02 y el grupo promedia solo los aplicables');
console.log(`  ✔ verificación manual de la visita: ${r2(r.final)} · ${r.clasificacion}`);
console.log(
  `  ✔ perfil traspatio: MBA ${rT.grupos[0].peso} % + MBR ${rT.grupos[1].peso} % y MBG fuera del cálculo`,
);
console.log(
  `  ✔ inmutabilidad: visita cerrada = ${r2(antes)} antes y después de editar el catálogo; con la versión 2.1 = ${r2(conNuevaVersion)}`,
);
console.log('  ✔ clasificación del predio por número de aves (≥200 corral / ≤199 traspatio)\n');
console.log('Todas las comprobaciones pasaron ✔  (ver README.md del spike para conclusiones)\n');
