import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  InspeccionRespuesta,
  PeticionGuardarInspeccion,
} from './inspeccion.modelos';
import type { EnvioActa, Fase4 } from './cierre.modelos';
import type { Evidencia } from './fase2.modelos';

/** Respuesta al registrar una evidencia: metadatos y URL firmada de subida. */
export interface EvidenciaSubida {
  evidencia: Evidencia;
  urlSubida: string;
}

/** Datos que se registran antes de subir una foto (RF23). */
export interface DatosEvidencia {
  galponNumero?: number;
  indicadorCodigo?: string;
  nombre: string;
  tipo: string;
  tamano: number;
  hash?: string;
}

/**
 * Acceso HTTP a la apertura y ficha general, Fase I (M3 · RF13–RF17), y a la
 * inspección en galpón, Fase II (M4 · RF18–RF26).
 *
 * Solo habla con el servidor; el guardado sin conexión (RF12) vive en
 * `SincronizacionService`, que reutiliza el mismo endpoint. Las evidencias
 * (RF23) se suben directo al almacenamiento con la URL firmada que da el
 * backend (ADR-003): el binario nunca pasa por la API.
 */
@Injectable({ providedIn: 'root' })
export class InspeccionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inspeccion`;

  /** Ficha general, catálogo y Fase II de una visita (RF13–RF26). */
  obtener(visitaId: string): Observable<InspeccionRespuesta> {
    return this.http.get<InspeccionRespuesta>(`${this.base}/${visitaId}`);
  }

  /** Guarda la ficha general, la Fase I y las evaluaciones de la Fase II. */
  guardar(
    visitaId: string,
    peticion: PeticionGuardarInspeccion,
  ): Observable<InspeccionRespuesta> {
    return this.http.put<InspeccionRespuesta>(
      `${this.base}/${visitaId}`,
      peticion,
    );
  }

  // ------------------------------------------------------- evidencias (RF23)

  /** Registra la evidencia y recibe la URL firmada para subirla (ADR-003). */
  crearEvidencia(
    visitaId: string,
    datos: DatosEvidencia,
  ): Observable<EvidenciaSubida> {
    return this.http.post<EvidenciaSubida>(
      `${this.base}/${visitaId}/evidencias`,
      datos,
    );
  }

  /**
   * Sube el archivo directo al almacenamiento con la URL firmada. Es un `PUT`
   * sin token: la firma de la URL es la autorización (ADR-003).
   */
  subirArchivo(url: string, archivo: File): Observable<unknown> {
    return this.http.put(url, archivo, {
      headers: new HttpHeaders({ 'Content-Type': archivo.type }),
    });
  }

  /** Confirma que el archivo llegó al almacenamiento (ADR-003). */
  confirmarEvidencia(id: string): Observable<Evidencia> {
    return this.http.post<Evidencia>(
      `${this.base}/evidencias/${id}/confirmar`,
      {},
    );
  }

  /** URL firmada de vida corta para consultar la evidencia (RNF22). */
  urlEvidencia(id: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/evidencias/${id}/url`);
  }

  /** Borra una evidencia (RF23). */
  eliminarEvidencia(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/evidencias/${id}`);
  }

  // ------------------------------------------------- cierre y acta (RF39–RF45)

  /**
   * Firma y emite la siguiente acta de la visita (RF41–RF43) y devuelve el
   * cierre actualizado. El cierre no se encola sin conexión: el acta se emite
   * contra el servidor, que es quien genera y guarda el PDF.
   */
  firmarActa(visitaId: string, firma: string): Observable<Fase4> {
    return this.http.post<Fase4>(`${this.base}/${visitaId}/acta`, { firma });
  }

  /** Envía el acta al responsable por correo (RF45). */
  enviarActa(visitaId: string, destinatario?: string): Observable<EnvioActa> {
    return this.http.post<EnvioActa>(
      `${this.base}/${visitaId}/acta/correo`,
      destinatario ? { destinatario } : {},
    );
  }

  /** URL firmada de vida corta para descargar el acta vigente (RNF22). */
  urlActa(visitaId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.base}/${visitaId}/acta/descarga`,
    );
  }
}
