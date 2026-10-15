/**
 * Configuración del frontend para producción.
 *
 * La URL de la API se reemplaza al desplegar (Cloud Run). Por ahora apunta al
 * mismo origen de la API desplegada; se ajustará cuando exista el dominio del
 * proyecto (pendiente: RNFG06, despliegue en Google Cloud).
 */
export const environment = {
  produccion: true,
  apiUrl: '/api/v1',
};
