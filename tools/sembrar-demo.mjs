#!/usr/bin/env node
/**
 * Sembrador de datos de demostración: 52 granjas con visitas e inspecciones
 * completas para poblar la interfaz (listado de visitas y panel, RF10) y
 * visualizar las gráficas con información realista.
 *
 * Cómo funciona:
 * - Trabaja contra la API real (por defecto http://localhost:3000/api/v1), no
 *   contra la base de datos: la calificación y la clasificación las calcula el
 *   propio motor (M6 · RF34–RF38), así que todo lo sembrado queda garantizado
 *   como válido por las reglas del servidor.
 * - Cada granja usa un identificador de visita fijo (bloque
 *   `d3e00000-0000-4000-8000-…`) y un generador pseudoaleatorio con semilla:
 *   volver a ejecutarlo no duplica nada (RF12) y produce los mismos datos.
 * - Las visitas quedan a cargo del usuario con el que se inicie sesión; con el
 *   inspector de pruebas las ven el Inspector (solo las suyas) y el
 *   Administrador (todas). Para volver a ejecutarlo, use el mismo usuario: las
 *   visitas cerradas no se editan y se saltan; las abiertas se reescriben con
 *   los mismos datos.
 *
 * Qué siembra:
 * - 40 visitas cerradas con cálculo completo, repartidas en los últimos 6
 *   meses (los de la gráfica de evolución), con niveles Excelente / Alto /
 *   Medio / Bajo y puntajes objetivo distintos.
 * - 3 visitas en curso (a medio diligenciar), 3 pendientes de documentos
 *   (2 documentos de gestión sin entregar) y 6 programadas para los próximos
 *   días (alimentan «próximas visitas»).
 * - Granjas de corral (pollo de engorde, ponedora en piso y ponedora en jaula)
 *   y de traspatio, con uno o dos galpones, en municipios avícolas reales.
 *
 * Uso (la contraseña va por variable de entorno; no vive en el repositorio):
 *   PASSWORD='…' node tools/sembrar-demo.mjs
 *   PASSWORD='…' CORREO='admin@ica.local' node tools/sembrar-demo.mjs
 *
 * Para empezar de cero (borra solo lo sembrado por este guion):
 *   docker exec -i ica-postgres psql -U ica -d ica <<'SQL'
 *   BEGIN;
 *   CREATE TEMP TABLE demo AS
 *     SELECT DISTINCT predio_id FROM visita WHERE id::text LIKE 'd3e00000-%';
 *   DELETE FROM visita WHERE id::text LIKE 'd3e00000-%';
 *   DELETE FROM predio WHERE id IN (SELECT predio_id FROM demo)
 *     AND NOT EXISTS (SELECT 1 FROM visita v WHERE v.predio_id = predio.id);
 *   COMMIT;
 *   SQL
 */

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const CORREO = process.env.CORREO ?? 'inspector.pruebas@ica.local';
const PASSWORD = process.env.PASSWORD;

if (!PASSWORD) {
  console.error(
    "Falta la contraseña. Ejecute: PASSWORD='…' node tools/sembrar-demo.mjs",
  );
  process.exit(1);
}

let token;

async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`${metodo} ${ruta} → ${respuesta.status}: ${texto}`);
  }
  return texto ? JSON.parse(texto) : null;
}

// ------------------------------------------------------------- generadores

/** Generador pseudoaleatorio reproducible (mulberry32). */
function rngConSemilla(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function acotar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

/** Nivel de clasificación de un puntaje (RF36), para verificar el objetivo. */
function nivelDe(puntaje) {
  if (puntaje >= 90) return 'EXCELENTE';
  if (puntaje >= 75) return 'ALTO';
  if (puntaje >= 50) return 'MEDIO';
  return 'BAJO';
}

/**
 * Puntaje 0/1/2 de un punto al azar, con la media pedida (entre 0 y 2). En
 * promedio, el indicador queda en el objetivo del grupo.
 */
function puntajeDeObjetivo(rng, objetivo) {
  const medio = (acotar(objetivo, 0, 100) / 100) * 2;
  const azar = rng();
  if (medio >= 1) return azar < medio - 1 ? 2 : 1;
  return azar < medio ? 1 : 0;
}

// -------------------------------------------------------------- plan de siembra

const TOTAL = 52;

const PREFIJOS = [
  'Granja',
  'Granja',
  'Avícola',
  'Finca',
  'Granja',
  'Agropecuaria',
];

const NOMBRES = [
  'Santamaría',
  'El Vergel',
  'La Primavera',
  'Los Alpes',
  'Buenos Aires',
  'Santa Isabel',
  'La Fortuna',
  'El Recuerdo',
  'La Unión',
  'San Rafael',
  'Los Cerezos',
  'La Pradera',
  'El Rincón',
  'Santa Helena',
  'La Aurora',
  'El Edén',
  'San José',
  'La Estrella',
  'El Portal',
  'La Joya',
  'San Antonio',
  'Los Robles',
  'La Palmera',
  'El Horizonte',
  'Santa Rita',
  'La Campiña',
  'El Lago',
  'San Pablo',
  'La Serena',
  'El Faro',
  'La Vega',
  'San Martín',
  'Los Nogales',
  'La Trinidad',
  'El Sol',
  'Santa Bárbara',
  'La Montaña',
  'El Molino',
  'San Bernardo',
  'La Riviera',
  'El Rosario',
  'Santa Teresita',
  'La Cabrera',
  'El Guayabo',
  'San Fernando',
  'La Floresta',
  'El Cortijo',
  'Las Acacias',
  'La Granadilla',
  'El Trapiche',
  'Los Naranjos',
  'San Vicente',
];

const MUNICIPIOS = [
  ['Fusagasugá', 'El Placer'],
  ['Ubaté', 'La Voluntad'],
  ['Chía', 'Fagua'],
  ['Sibaté', 'San Benito'],
  ['Soacha', 'Chacua'],
  ['Madrid', 'La Punta'],
  ['Mosquera', 'Balsillas'],
  ['Facatativá', 'El Corzo'],
  ['Zipaquirá', 'Barandillas'],
  ['Tocancipá', 'Canavita'],
  ['Guaduas', 'Cordero'],
  ['Piedecuesta', 'Mensulí'],
  ['Girón', 'Ruitoque'],
  ['Palmira', 'Rozo'],
  ['Guadalajara de Buga', 'Chambimbal'],
  ['El Cerrito', 'El Pomo'],
  ['Rionegro', 'La Convención'],
  ['La Ceja', 'El Tambo'],
  ['Duitama', 'La Trinidad'],
  ['Paipa', 'El Salitre'],
  ['El Espinal', 'Chicoral'],
  ['Armenia', 'El Caimo'],
  ['Santa Rosa de Cabal', 'La Linda'],
  ['Sabanalarga', 'La Cordialidad'],
];

const RESPONSABLES = [
  'Jorge Ramírez',
  'Marta Rodríguez',
  'Carlos Rojas',
  'Luis Pérez',
  'Ana Gómez',
  'Pedro Vargas',
  'Gloria Castaño',
  'Óscar Herrera',
  'Diana Molina',
  'Fabio Ríos',
  'Sandra Quintero',
  'Andrés Salazar',
  'Claudia Muñoz',
  'Nelson Torres',
  'Beatriz Duarte',
  'Hugo Cárdenas',
  'Paola Restrepo',
  'Julián Ospina',
  'Rocío Pineda',
  'Wilson Araújo',
];

/** Grupo productivo que rota por las granjas de corral (RF15). */
const GRUPOS_CORRAL = [
  'POLLO_ENGORDE',
  'POLLO_ENGORDE',
  'PONEDORA_JAULA',
  'PONEDORA_PISO',
  'POLLO_ENGORDE',
  'PONEDORA_PISO',
  'PONEDORA_JAULA',
  'PONEDORA_PISO',
  'POLLO_ENGORDE',
  'PONEDORA_JAULA',
];

const GRUPOS_TRASPATIO = [
  'POLLO_ENGORDE',
  'PONEDORA_PISO',
  'PONEDORA_PISO',
  'POLLO_ENGORDE',
  'PONEDORA_PISO',
  'POLLO_ENGORDE',
];

/** Posiciones (base 0) que son traspatio: cinco cerradas y una programada. */
const POSICIONES_TRASPATIO = new Set([7, 15, 23, 31, 39, 47]);

/**
 * Puntajes objetivo de las visitas cerradas, del mes más viejo al actual: dan
 * una curva de evolución con subidas y bajadas y una mezcla de niveles. Cada
 * lista es un mes (5 meses atrás … mes actual).
 */
const PUNTAJES_POR_MES = [
  [75.7, 71.4, 64.7, 58.6, 43.5], // hace 5 meses
  [90.6, 80.2, 78.6, 72.6, 69.1, 61.3], // hace 4
  [91.1, 83.2, 82.1, 70.2, 66.2, 54.8, 47.8], // hace 3
  [92.2, 85.2, 81.3, 79.4, 73.8, 63.1, 37.6], // hace 2
  [94.9, 93.8, 88.8, 87.4, 84.4, 77.0, 76.3, 67.8], // hace 1
  [96.6, 92.9, 91.8, 91.4, 90.8, 86.6, 77.8], // mes actual
];

/** Sesgos por grupo productivo: unos predios van mejor en unos grupos. */
const SESGOS = [
  { MBA: 4, MBR: -4, MBG: 0 },
  { MBA: -6, MBR: 4, MBG: 2 },
  { MBA: 2, MBR: 3, MBG: -5 },
  { MBA: -3, MBR: -2, MBG: 5 },
  { MBA: 6, MBR: -6, MBG: 0 },
  { MBA: 0, MBR: 5, MBG: -5 },
  { MBA: -5, MBR: 0, MBG: 5 },
];

const DIAS_EN_CURSO = [1, 3, 5];
const DIAS_PENDIENTE = [2, 6, 9];
const DIAS_PROGRAMADA = [1, 2, 4, 7, 15, 22];

const HOY = new Date();

/** Fecha del mes ya pasado (0 = mes en curso) en el día pedido. */
function fechaDelMes(mesesAtras, dia) {
  const primero = new Date(
    Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth() - mesesAtras, 1),
  );
  const ultimo = new Date(
    Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0),
  ).getUTCDate();
  let diaFinal = Math.min(dia, ultimo);
  if (mesesAtras === 0) {
    diaFinal = Math.max(1, Math.min(diaFinal, HOY.getUTCDate() - 2));
  }
  primero.setUTCDate(diaFinal);
  return primero;
}

/** Fecha a tantos días de hoy (positivos = futuro, negativos = pasado). */
function fechaRelativa(dias) {
  return new Date(
    Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth(), HOY.getUTCDate() + dias),
  );
}

/** Datos de producción de la granja según su grupo productivo y tamaño. */
function planProductivo(i, traspatio, grupo) {
  let aves;
  let edadSemanas;
  let sistema;
  if (traspatio) {
    aves = 80 + 20 * (i % 6);
    edadSemanas = 30 + 10 * (i % 4);
    sistema = i % 2 === 0 ? 'PASTOREO' : 'PISO';
  } else if (grupo === 'POLLO_ENGORDE') {
    aves = 25000 + 25000 * (i % 6);
    edadSemanas = 3 + (i % 4);
    sistema = i % 3 === 0 ? 'ABIERTO_MECANIZADO' : 'AMBIENTE_CONTROLADO';
  } else if (grupo === 'PONEDORA_JAULA') {
    aves = 40000 + 30000 * (i % 5);
    edadSemanas = 30 + 8 * (i % 5);
    sistema = 'JAULA';
  } else {
    aves = 8000 + 12000 * (i % 5);
    edadSemanas = 30 + 8 * (i % 5);
    sistema = ['PISO', 'PASTOREO', 'ABIERTO_NO_MECANIZADO'][i % 3];
  }

  // La metodología sugiere un galpón para menos de 50.000 aves y dos de ahí en
  // adelante (M3); las aves se reparten entre los galpones.
  const cuantos = aves >= 50000 ? 2 : 1;
  const galpones = [
    {
      numero: 1,
      edadSemanas,
      aves: cuantos === 2 ? Math.ceil(aves / 2) : aves,
      seleccionado: true,
    },
  ];
  if (cuantos === 2) {
    galpones.push({
      numero: 2,
      edadSemanas,
      aves: aves - Math.ceil(aves / 2),
      seleccionado: true,
    });
  }

  return {
    aves,
    galpones,
    sistema,
    jaula: grupo === 'PONEDORA_JAULA',
  };
}

/** Arma el plan de las 52 granjas (determinista: sin azar aquí). */
function construirPlan() {
  const cerradas = [];
  PUNTAJES_POR_MES.forEach((puntajes, indice) => {
    for (const puntaje of puntajes) {
      cerradas.push({
        puntaje,
        mesesAtras: PUNTAJES_POR_MES.length - 1 - indice,
      });
    }
  });

  const plan = [];
  let traspatios = 0;
  for (let i = 0; i < TOTAL; i += 1) {
    const traspatio = POSICIONES_TRASPATIO.has(i);
    const indiceTraspatio = traspatio ? traspatios : 0;
    if (traspatio) traspatios += 1;

    const prefijo = traspatio
      ? ['Finca', 'Granja', 'Finca', 'Granja', 'Finca', 'Granja'][
          indiceTraspatio
        ]
      : PREFIJOS[i % PREFIJOS.length];
    const nombre = `${prefijo} ${NOMBRES[i]}`;
    const [municipio, vereda] = MUNICIPIOS[i % MUNICIPIOS.length];
    const responsable = RESPONSABLES[i % RESPONSABLES.length];
    const grupoProductivo = traspatio
      ? GRUPOS_TRASPATIO[indiceTraspatio % GRUPOS_TRASPATIO.length]
      : GRUPOS_CORRAL[i % GRUPOS_CORRAL.length];
    const productivo = planProductivo(i, traspatio, grupoProductivo);

    let estado;
    let fecha;
    let puntaje;
    if (i < cerradas.length) {
      estado = 'CERRADA';
      puntaje = cerradas[i].puntaje;
      fecha = fechaDelMes(cerradas[i].mesesAtras, 3 + ((i * 7) % 22));
    } else if (i < cerradas.length + DIAS_EN_CURSO.length) {
      estado = 'EN_CURSO';
      puntaje = 75 + (i % 15);
      fecha = fechaRelativa(-DIAS_EN_CURSO[i - cerradas.length]);
    } else if (
      i <
      cerradas.length + DIAS_EN_CURSO.length + DIAS_PENDIENTE.length
    ) {
      estado = 'PENDIENTE_DOCUMENTOS';
      puntaje = 75 + (i % 15);
      fecha = fechaRelativa(
        -DIAS_PENDIENTE[i - cerradas.length - DIAS_EN_CURSO.length],
      );
    } else {
      estado = 'PROGRAMADA';
      puntaje = null;
      fecha = fechaRelativa(
        DIAS_PROGRAMADA[
          i - cerradas.length - DIAS_EN_CURSO.length - DIAS_PENDIENTE.length
        ],
      );
    }

    // Hora del día variada, en horario laboral de Colombia (UTC-5).
    fecha.setUTCHours(13 + (i % 5), (i % 4) * 15, 0, 0);

    plan.push({
      i,
      visitaId: `d3e00000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      nombre,
      municipio,
      vereda,
      responsable,
      traspatio,
      grupoProductivo,
      aves: productivo.aves,
      galpones: productivo.galpones,
      sistema: productivo.sistema,
      jaula: productivo.jaula,
      estado,
      fecha,
      puntaje,
      sesgo: SESGOS[i % SESGOS.length],
    });
  }
  return plan;
}

// ----------------------------------------------------- respuestas del inspector

/**
 * Objetivo por grupo de medidas: el puntaje pedido más el sesgo del predio,
 * reequilibrado para que el final (suma ponderada) siga siendo el pedido. En
 * traspatio el grupo de gestión no pesa (RF33): solo entran los grupos con
 * peso.
 */
function objetivosPorGrupo(puntaje, grupos, sesgo) {
  const conPeso = grupos.filter((grupo) => Number(grupo.peso) > 0);
  const desvio = conPeso.reduce(
    (total, grupo) =>
      total + (Number(grupo.peso) / 100) * (sesgo[grupo.grupo] ?? 0),
    0,
  );
  const objetivos = {};
  for (const { grupo } of conPeso) {
    objetivos[grupo] = acotar(puntaje + (sesgo[grupo] ?? 0) - desvio, 0, 100);
  }
  return objetivos;
}

/** Evaluación de la Fase II de un indicador en un galpón (RF18–RF22). */
function evaluacionDe(definicion, objetivo, farm, rng, galponNumero) {
  const cuantos = definicion.tipoMuestreo === 'HOJAS_CENTINELA' ? 3 : 9;
  const puntos = Array.from({ length: cuantos }, (_, indice) => ({
    numero: indice + 1,
    puntaje: puntajeDeObjetivo(rng, objetivo),
    // Muestras dentro de lo que pide la metodología (RF20): piso 15–30 aves;
    // jaula 3–5 jaulas con 10–20 aves.
    aves: farm.jaula ? 15 : 20,
    jaulas: farm.jaula ? 4 : null,
  }));
  return { galponNumero, indicadorCodigo: definicion.codigo, puntos };
}

/** Verificación de un documento de la Fase III (RF27–RF31). */
function documentoDe(definicion, objetivo, farm, rng) {
  const base = {
    indicadorCodigo: definicion.codigo,
    presentado: true,
    legible: true,
    firmadoResponsable: true,
    firmadoProfesional: definicion.exigeFirmaProfesional ? true : null,
  };
  if (definicion.tipoEvaluacion === 'MORTALIDAD') {
    // La tasa se elige según RF30 (el servidor la convierte a puntaje con los
    // rangos del catálogo): engorde ≤ 6 % son 2; ponedoras ≤ 12 % son 2.
    const tasas =
      farm.grupoProductivo === 'POLLO_ENGORDE'
        ? { 2: 4.4, 1: 7.6, 0: 10.9 }
        : { 2: 9.6, 1: 13.2, 0: 15.8 };
    return {
      ...base,
      mortalidad: tasas[puntajeDeObjetivo(rng, objetivo)],
    };
  }
  return { ...base, puntaje: puntajeDeObjetivo(rng, objetivo) };
}

/** Evaluaciones y documentos de una visita, según el estado que se persigue. */
function generarRespuestas(farm, ficha, objetivos, rng) {
  const catalogo = new Map(
    ficha.catalogo.indicadores.map((indicador) => [
      indicador.codigo,
      indicador,
    ]),
  );
  const evaluaciones = [];
  const documentos = [];

  ficha.calculo.indicadores.forEach((aplicable, indice) => {
    const definicion = catalogo.get(aplicable.codigo);
    const objetivo = objetivos[aplicable.grupo] ?? 80;

    if (aplicable.grupo === 'MBG') {
      if (farm.traspatio) return; // en traspatio no hay fase documental (RF33)
      documentos.push(documentoDe(definicion, objetivo, farm, rng));
      return;
    }

    // Visitas en curso: se deja un tercio de los indicadores sin diligenciar.
    if (farm.estado === 'EN_CURSO' && indice % 3 === 2) return;

    for (const galpon of farm.galpones) {
      evaluaciones.push(
        evaluacionDe(definicion, objetivo, farm, rng, galpon.numero),
      );
    }
  });

  // Pendientes de documentos: dos documentos se dejan por entregar (RF31);
  // sin puntaje todavía, la visita no publica calificación.
  if (farm.estado === 'PENDIENTE_DOCUMENTOS') {
    for (let j = 0; j < Math.min(2, documentos.length); j += 1) {
      documentos[j] = {
        indicadorCodigo: documentos[j].indicadorCodigo,
        presentado: null,
        pendiente: true,
      };
    }
  }

  return { evaluaciones, documentos };
}

// ------------------------------------------------------------------ ejecución

const CENTRO_NIVEL = { EXCELENTE: 95, ALTO: 82.5, MEDIO: 62.5, BAJO: 40 };
const ETIQUETA_NIVEL = {
  EXCELENTE: 'Excelente',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAJO: 'Bajo',
};

async function sembrarGranja(farm, nueva) {
  const visita = await pedir('POST', '/visitas', {
    id: farm.visitaId,
    predio: {
      nombre: farm.nombre,
      municipio: farm.municipio,
      vereda: farm.vereda,
      tipoPredio: farm.traspatio ? 'TRASPATIO' : 'CORRAL',
    },
    programadaPara: farm.fecha.toISOString(),
    observaciones:
      'Granja de demostración para visualizar el panel y los reportes.',
  });

  if (visita.estado === 'CERRADA') {
    return 'ya sembrada';
  }
  if (farm.estado === 'PROGRAMADA') {
    return nueva ? 'programada' : 'ya estaba programada';
  }

  // Fase I: ficha del predio y galpones (RF13–RF17).
  const ficha = await pedir('PUT', `/inspeccion/${farm.visitaId}`, {
    nombrePredio: farm.nombre,
    municipio: farm.municipio,
    vereda: farm.vereda,
    responsable: farm.responsable,
    numeroAves: farm.aves,
    sistemaProduccion: farm.sistema,
    fechaHora: farm.fecha.toISOString(),
    grupoProductivo: farm.grupoProductivo,
    galpones: farm.galpones,
  });

  const rng = rngConSemilla(0x5a17 + farm.i * 7919);
  let calculo = null;
  let nota = '';

  // Las Fases II y III se guardan juntas. Si la calificación queda al otro
  // lado de una frontera (la aleatoriedad de los puntos), se ajusta el
  // objetivo hacia el centro del nivel y se reintenta.
  for (let intento = 1; intento <= 4; intento += 1) {
    const objetivos = objetivosPorGrupo(
      farm.puntaje,
      ficha.calculo.grupos,
      farm.sesgo,
    );
    const respuestas = generarRespuestas(farm, ficha, objetivos, rng);
    const guardada = await pedir('PUT', `/inspeccion/${farm.visitaId}`, {
      evaluaciones: respuestas.evaluaciones,
      ...(respuestas.documentos.length > 0
        ? { documentos: respuestas.documentos }
        : {}),
    });
    calculo = guardada.calculo;

    if (farm.estado !== 'CERRADA') break;

    const incompletos = calculo.indicadores
      .filter((indicador) => !indicador.completo)
      .map((indicador) => indicador.codigo);
    if (incompletos.length > 0) {
      throw new Error(
        `${farm.nombre}: la visita quedó incompleta (${incompletos.join(', ')}).`,
      );
    }

    const nivel = nivelDe(farm.puntaje);
    if (calculo.clasificacion === nivel) break;
    if (intento === 4) {
      throw new Error(
        `${farm.nombre}: el final quedó en ${calculo.final} y no se pudo fijar en «${ETIQUETA_NIVEL[nivel]}».`,
      );
    }
    farm.puntaje += CENTRO_NIVEL[nivel] - calculo.final;
    nota = ' (objetivo ajustado)';
  }

  // Estados (RF09): de programada a en curso y al estado perseguido.
  let estadoActual = visita.estado;
  const pasos =
    farm.estado === 'CERRADA'
      ? ['EN_CURSO', 'CERRADA']
      : farm.estado === 'PENDIENTE_DOCUMENTOS'
        ? ['EN_CURSO', 'PENDIENTE_DOCUMENTOS']
        : ['EN_CURSO'];
  for (const paso of pasos) {
    if (estadoActual === paso) continue;
    await pedir('PATCH', `/visitas/${farm.visitaId}/estado`, { estado: paso });
    estadoActual = paso;
  }

  if (farm.estado !== 'CERRADA') {
    return `${nueva ? '' : 'refrescada · '}en preparación (final parcial ${calculo?.final ?? '—'}, sin publicar)`;
  }
  return `${calculo.final.toFixed(2)} · ${ETIQUETA_NIVEL[calculo.clasificacion]}${nota}`;
}

/** Identificadores de las visitas ya existentes (paginado). */
async function idsExistentes() {
  const ids = new Set();
  let pagina = 1;
  for (;;) {
    const lista = await pedir('GET', `/visitas?porPagina=100&pagina=${pagina}`);
    for (const fila of lista.datos) ids.add(fila.id);
    if (pagina * 100 >= lista.total) break;
    pagina += 1;
  }
  return ids;
}

async function main() {
  const sesion = await pedir('POST', '/auth/login', {
    correo: CORREO,
    password: PASSWORD,
  });
  token = sesion.accessToken;
  console.log(`— Sesión iniciada como ${CORREO}`);

  const plan = construirPlan();
  const existentes = await idsExistentes();
  let nuevas = 0;
  for (const farm of plan) {
    const nueva = !existentes.has(farm.visitaId);
    const resultado = await sembrarGranja(farm, nueva);
    if (nueva) nuevas += 1;
    console.log(
      `[${String(farm.i + 1).padStart(2)}/${TOTAL}] ${farm.nombre} · ${farm.estado} · ${resultado}`,
    );
  }

  // Resumen del panel (RF10): así queda la interfaz con los datos sembrados.
  const resumen = await pedir('GET', '/visitas/resumen');
  console.log('\n— Resumen del panel —');
  console.log(
    `Visitas del mes: ${resumen.visitasDelMes}` +
      (resumen.variacionVisitas === null
        ? ''
        : ` (${resumen.variacionVisitas > 0 ? '+' : ''}${resumen.variacionVisitas} % vs mes anterior)`),
  );
  console.log(
    `Calificación promedio: ${resumen.calificacionPromedio ?? '—'} · ${resumen.etiquetaClasificacionPromedio ?? '—'}`,
  );
  console.log(
    `Documentos pendientes: ${resumen.documentosPendientes} · Visitas totales: ${resumen.totalVisitas} · Predios: ${resumen.predios}`,
  );
  console.log('Evolución:');
  for (const mes of resumen.evolucion) {
    console.log(
      `  ${mes.etiqueta}: ${mes.calificacion ?? '—'} (${mes.visitas} visita(s))`,
    );
  }
  console.log('Distribución por clasificación:');
  for (const fila of resumen.distribucion) {
    console.log(`  ${fila.etiqueta}: ${fila.cantidad} (${fila.porcentaje} %)`);
  }
  console.log('Promedio por grupo de medidas:');
  for (const fila of resumen.promedioPorGrupo) {
    console.log(
      `  ${fila.etiqueta}: ${fila.promedio ?? '—'} (peso ${fila.peso ?? '—'} %)`,
    );
  }

  console.log(
    `\nListo: ${nuevas} granja(s) nuevas y ${TOTAL - nuevas} ya existentes (volver a ejecutar no duplica).`,
  );
}

await main();
