import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  InspeccionRespuesta,
  PeticionGuardarInspeccion,
} from './inspeccion.modelos';

/**
 * Acceso HTTP a la apertura y ficha general, Fase I (M3 · RF13–RF17).
 *
 * Solo habla con el servidor; el guardado sin conexión (RF12) vive en
 * `SincronizacionService`, que reutiliza el mismo endpoint.
 */
@Injectable({ providedIn: 'root' })
export class InspeccionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inspeccion`;

  /** Ficha general y catálogo de una visita (RF13–RF17). */
  obtener(visitaId: string): Observable<InspeccionRespuesta> {
    return this.http.get<InspeccionRespuesta>(`${this.base}/${visitaId}`);
  }

  /** Guarda la ficha general y la Fase I (RF13–RF16). */
  guardar(
    visitaId: string,
    peticion: PeticionGuardarInspeccion,
  ): Observable<InspeccionRespuesta> {
    return this.http.put<InspeccionRespuesta>(
      `${this.base}/${visitaId}`,
      peticion,
    );
  }
}
