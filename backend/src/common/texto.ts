/** Normaliza un correo: sin espacios y en minúsculas (evita duplicados). */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Limpia un texto de espacios al inicio y al final. */
export function limpiarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}
