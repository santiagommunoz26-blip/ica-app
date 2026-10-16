import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  EstadoVisita,
  FiltrosVisitas,
  ListaVisitas,
  PeticionActualizarVisita,
  PeticionCrearVisita,
  Predio,
  ResumenPanel,
  RespuestaSincronizacion,
  Visita,
} from './visitas.modelos';

/** Resultado de programar una visita con predio nuevo. */

/**
 * Acceso HTTP a la API de visitas (M2 · RF08–RF12).
 *
 * Solo habla con el servidor; el comportamiento sin conexión (guardar los
 * cambios en el equipo y sincronizarlos) vive en `SincronizacionService`.
 */
@Injectable({ providedIn: 'root' })
export class VisitasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/visitas`;

  /** Lista visitas con búsqueda, filtros y conteos (RF11). */
  listar(filtros: FiltrosVisitas = {}): Observable<ListaVisitas> {
    return this.http.get<ListaVisitas>(this.base, {
      params: this.aParametros(filtros),
    });
  }

  /** Una visita con su predio y su inspector. */
  obtener(id: string): Observable<Visita> {
    return this.http.get<Visita>(`${this.base}/${id}`);
  }

  /** Indicadores del panel principal (RF10). */
  resumen(): Observable<ResumenPanel> {
    return this.http.get<ResumenPanel>(`${this.base}/resumen`);
  }

  /** Predios registrados, para asociar una visita. */
  predios(busqueda?: string): Observable<Predio[]> {
    const parametros = busqueda
      ? new HttpParams().set('busqueda', busqueda)
      : undefined;
    return this.http.get<Predio[]>(`${this.base}/predios`, {
      params: parametros,
    });
  }

  /** Municipios que ya aparecen en las visitas, para el filtro (RF11). */
  municipios(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/municipios`);
  }

  /** Programa una visita (RF08). */
  crear(peticion: PeticionCrearVisita): Observable<Visita> {
    return this.http.post<Visita>(this.base, peticion);
  }

  /** Edita una visita programada. */
  actualizar(
    id: string,
    peticion: PeticionActualizarVisita,
  ): Observable<Visita> {
    return this.http.patch<Visita>(`${this.base}/${id}`, peticion);
  }

  /** Cambia el estado de una visita (RF09). */
  cambiarEstado(id: string, estado: EstadoVisita): Observable<Visita> {
    return this.http.patch<Visita>(`${this.base}/${id}/estado`, { estado });
  }

  /** Envía las operaciones hechas sin conexión (RF12). */
  sincronizar(operaciones: unknown[]): Observable<RespuestaSincronizacion> {
    return this.http.post<RespuestaSincronizacion>(`${this.base}/sincronizar`, {
      operaciones,
    });
  }

  private aParametros(filtros: FiltrosVisitas): HttpParams {
    let parametros = new HttpParams();
    const agregar = (clave: string, valor: string | number | undefined) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        parametros = parametros.set(clave, String(valor));
      }
    };
    agregar('pagina', filtros.pagina);
    agregar('porPagina', filtros.porPagina);
    agregar('busqueda', filtros.busqueda);
    agregar('municipio', filtros.municipio);
    agregar('estado', filtros.estado);
    agregar('tipoPredio', filtros.tipoPredio);
    agregar('desde', filtros.desde);
    agregar('hasta', filtros.hasta);
    agregar('inspectorId', filtros.inspectorId);
    return parametros;
  }
}
