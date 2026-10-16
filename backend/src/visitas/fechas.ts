/**
 * Fechas de las visitas en la zona horaria del país.
 *
 * Las fechas se guardan en UTC (`timestamptz`), pero «la visita del 20 de
 * octubre a las 9:00» y los indicadores del panel («visitas del mes», la
 * evolución de los últimos seis meses) se leen en la hora del país. Agrupar en
 * UTC movería una visita de las 20:00 al día siguiente.
 */
export const ZONA_HORARIA = 'America/Bogota';

/** Nombres cortos de los meses, como en el wireframe (May, Jun…). */
const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha local del país, en formato `YYYY-MM-DD`. */
export function fechaEnZona(fecha: Date, zona = ZONA_HORARIA): string {
  const formato =
    zona === ZONA_HORARIA
      ? FORMATO_FECHA
      : new Intl.DateTimeFormat('en-CA', {
          timeZone: zona,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
  return formato.format(fecha);
}

/** Mes local del país, en formato `YYYY-MM`. */
export function mesEnZona(fecha: Date, zona = ZONA_HORARIA): string {
  return fechaEnZona(fecha, zona).slice(0, 7);
}

/** Suma meses (positivos o negativos) a un `YYYY-MM`. */
export function sumarMeses(mes: string, cantidad: number): string {
  const anio = Number(mes.slice(0, 4));
  const indice = Number(mes.slice(5, 7)) - 1 + cantidad;
  const anioFinal = anio + Math.floor(indice / 12);
  const mesFinal = ((indice % 12) + 12) % 12;
  return `${anioFinal}-${String(mesFinal + 1).padStart(2, '0')}`;
}

/** Últimos `cantidad` meses que terminan en `hasta` (incluido), del más antiguo al más reciente. */
export function ultimosMeses(cantidad: number, hasta: string): string[] {
  const meses: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    meses.push(sumarMeses(hasta, -i));
  }
  return meses;
}

/** Etiqueta corta de un mes `YYYY-MM` («Oct»). */
export function etiquetaMes(mes: string): string {
  return MESES_CORTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/**
 * Normaliza una fecha que llega por la API a `YYYY-MM-DD`.
 * Si ya viene como fecha se respeta; si trae hora, se convierte a la hora del país.
 */
export function aFechaEnZona(iso: string, zona = ZONA_HORARIA): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : fechaEnZona(new Date(iso), zona);
}
