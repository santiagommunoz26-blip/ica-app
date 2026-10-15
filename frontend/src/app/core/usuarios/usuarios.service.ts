import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  EstadoUsuario,
  FiltrosUsuarios,
  ListaBitacora,
  ListaUsuarios,
  PeticionActualizarUsuario,
  PeticionCrearUsuario,
  RolCatalogo,
  Usuario,
  UsuarioCreadoRespuesta,
} from '../auth/auth.modelos';

/** Administración de usuarios (M1 · RF05). Requiere rol Administrador. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;

  /** Lista usuarios con búsqueda, filtros y paginación. */
  listar(filtros: FiltrosUsuarios = {}): Observable<ListaUsuarios> {
    let parametros = new HttpParams();
    if (filtros.pagina) parametros = parametros.set('pagina', filtros.pagina);
    if (filtros.porPagina) {
      parametros = parametros.set('porPagina', filtros.porPagina);
    }
    if (filtros.busqueda) {
      parametros = parametros.set('busqueda', filtros.busqueda);
    }
    if (filtros.rol) parametros = parametros.set('rol', filtros.rol);
    if (filtros.estado) parametros = parametros.set('estado', filtros.estado);

    return this.http.get<ListaUsuarios>(this.base, { params: parametros });
  }

  /** Crea un usuario con contraseña temporal (RF05, RF07). */
  crear(peticion: PeticionCrearUsuario): Observable<UsuarioCreadoRespuesta> {
    return this.http.post<UsuarioCreadoRespuesta>(this.base, peticion);
  }

  /** Edita nombre, correo o rol de un usuario (RF05). */
  actualizar(
    id: string,
    peticion: PeticionActualizarUsuario,
  ): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.base}/${id}`, peticion);
  }

  /** Activa o inactiva un usuario (RF05). */
  cambiarEstado(id: string, estado: EstadoUsuario): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.base}/${id}/estado`, { estado });
  }

  /** Genera una contraseña temporal nueva (RF05). */
  restablecerPassword(id: string): Observable<UsuarioCreadoRespuesta> {
    return this.http.post<UsuarioCreadoRespuesta>(
      `${this.base}/${id}/restablecer-password`,
      {},
    );
  }

  /** Catálogo de roles y permisos (RF04), para el formulario de usuarios. */
  catalogoRoles(): Observable<RolCatalogo[]> {
    return this.http.get<RolCatalogo[]>(`${environment.apiUrl}/roles`);
  }

  /** Bitácora de auditoría (RNF11). */
  bitacora(porPagina = 20): Observable<ListaBitacora> {
    return this.http.get<ListaBitacora>(`${this.base}/registro-acceso`, {
      params: new HttpParams().set('porPagina', porPagina),
    });
  }
}
