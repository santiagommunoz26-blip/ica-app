// Componentes y servicios compartidos de la interfaz.
// M2–M8 deben reutilizar estos elementos en lugar de escribir su propio
// marcado, para que la línea gráfica sea única (RNF14).
export { AvisoComponent, type TipoAviso } from './aviso/aviso.component';
export { EncabezadoPaginaComponent } from './encabezado-pagina/encabezado-pagina.component';
export {
  EsqueletoComponent,
  type FormaEsqueleto,
} from './esqueleto/esqueleto.component';
export { EstadoVacioComponent } from './estado-vacio/estado-vacio.component';
export {
  InsigniaComponent,
  type TonoInsignia,
} from './insignia/insignia.component';
export {
  TarjetaComponent,
  type RellenoTarjeta,
  type VarianteTarjeta,
} from './tarjeta/tarjeta.component';
export {
  DialogoConfirmacionComponent,
  type DatosConfirmacion,
} from './confirmacion/dialogo-confirmacion.component';
export { ConfirmacionService } from './confirmacion/confirmacion.service';
export {
  NotificacionService,
  type TipoNotificacion,
} from './notificaciones/notificacion.service';
