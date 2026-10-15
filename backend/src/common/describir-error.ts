/**
 * Describe un error de forma útil en la consola.
 *
 * Node agrupa algunos fallos (por ejemplo el rechazo de conexión a PostgreSQL)
 * en un AggregateError cuyo `message` está vacío; sin esto solo se ve
 * «Error al ...: » y no hay pista de qué pasó.
 */
export function describirError(error: unknown): string {
  if (error instanceof AggregateError) {
    const detalles = error.errors.map(describirError).join('; ');
    const propio = error.message ? `: ${error.message}` : '';
    return `${error.name}${propio}${detalles ? ` [${detalles}]` : ''}`;
  }
  if (error instanceof Error) {
    const codigo = obtenerCodigo(error);
    return `${error.name}: ${error.message || '(sin mensaje)'}${
      codigo ? ` [${codigo}]` : ''
    }`;
  }
  return String(error);
}

/** Extrae el código de error si lo trae (por ejemplo ECONNREFUSED de pg). */
function obtenerCodigo(error: Error): string | undefined {
  const codigo = (error as { code?: unknown }).code;
  return typeof codigo === 'string' ? codigo : undefined;
}
