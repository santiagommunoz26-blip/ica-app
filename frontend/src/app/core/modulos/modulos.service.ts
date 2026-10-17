import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type GrupoMedida = 'MBA' | 'MBR' | 'MBG';
export const PUNTAJE_NO_APLICA_PREFIX = '[NO_APLICA]';
export type TipoPredio = 'CORRAL' | 'TRASPATIO';
export type GrupoProductivo =
  | 'PONEDORA_JAULA'
  | 'PONEDORA_PISO_PASTOREO'
  | 'POLLO_ENGORDE'
  | 'TRASPATIO_PONEDORA'
  | 'TRASPATIO_POLLO';

export interface IndicadorMetodologia {
  id: string;
  clave: string;
  nombre: string;
  grupoMedida: GrupoMedida;
  metodoEvaluacion: string;
  gruposProductivos: GrupoProductivo[];
  referenciaManual: string;
  escalaPuntaje: Record<'0' | '1' | '2', string>;
  activo: boolean;
}

export interface PesoMetodologia {
  id: string;
  tipoPredio: TipoPredio;
  grupoMedida: GrupoMedida;
  porcentaje: string;
}

export interface VersionMetodologia {
  id: string;
  nombre: string;
  notas: string | null;
  activa: boolean;
  createdAt: string;
}

export interface CatalogoMetodologia {
  version: VersionMetodologia;
  indicadores: IndicadorMetodologia[];
  pesos: PesoMetodologia[];
}

export interface EventoAuditoria {
  id: string;
  actorId: string | null;
  accion: string;
  recursoId: string | null;
  detalle: Record<string, unknown>;
  createdAt: string;
}

export interface ResultadoIndicador {
  indicadorId: string;
  clave: string;
  nombre: string;
  grupoMedida: GrupoMedida;
  puntaje: number;
  puntajesDisponibles?: number[];
  porcentaje: number;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  observacion: string | null;
}

export interface ResultadoVisita {
  grupoProductivo: GrupoProductivo;
  calificacionFinal: number;
  clasificacion: 'EXCELENTE' | 'ALTO' | 'MEDIO' | 'BAJO';
  grupos: {
    grupoMedida: GrupoMedida;
    promedio: number;
    peso: number;
    aporte: number;
  }[];
  indicadores: ResultadoIndicador[];
  observaciones: string | null;
}

export interface FilaHistorial {
  visita: {
    id: string;
    programadaPara: string;
    calificacion: string;
    clasificacion: string;
    predio: { id: string; nombre: string; tipoPredio: TipoPredio };
    inspector: { nombreCompleto: string };
  };
  acta: {
    id: string;
    resultadoSnapshot: ResultadoVisita;
    documentosPendientes: boolean;
    venceDocumentos: string | null;
    fechaDefinitiva: string | null;
    metodologiaVersion: { nombre: string };
    correoResponsable: string | null;
    correoEnviadoAt: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class ModulosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  catalogo(): Observable<CatalogoMetodologia> {
    return this.http.get<CatalogoMetodologia>(`${this.base}/modulo8/catalogo`);
  }

  versiones(): Observable<VersionMetodologia[]> {
    return this.http.get<VersionMetodologia[]>(`${this.base}/modulo8/versiones`);
  }

  guardarIndicador(indicador: Partial<IndicadorMetodologia>): Observable<CatalogoMetodologia> {
    return this.http.post<CatalogoMetodologia>(`${this.base}/modulo8/indicadores`, indicador);
  }

  actualizarIndicador(
    id: string,
    indicador: Partial<IndicadorMetodologia>,
  ): Observable<CatalogoMetodologia> {
    return this.http.patch<CatalogoMetodologia>(
      `${this.base}/modulo8/indicadores/${id}`,
      indicador,
    );
  }

  guardarPesos(
    tipoPredio: TipoPredio,
    pesos: { grupoMedida: GrupoMedida; porcentaje: number }[],
  ): Observable<CatalogoMetodologia> {
    return this.http.put<CatalogoMetodologia>(`${this.base}/modulo8/pesos`, {
      tipoPredio,
      pesos,
    });
  }

  historial(): Observable<FilaHistorial[]> {
    return this.http.get<FilaHistorial[]>(`${this.base}/modulo7/historial`);
  }

  resultados(visitaId: string): Observable<{
    visitaId: string;
    resultado: ResultadoVisita;
    versionMetodologia: string;
    documentosPendientes: boolean;
    venceDocumentos: string | null;
    definitiva: boolean;
    predio: { id: string; nombre: string; tipoPredio: TipoPredio };
    fechaVisita: string;
    inspector: { nombreCompleto: string };
  }> {
    return this.http.get<{
      visitaId: string;
      resultado: ResultadoVisita;
      versionMetodologia: string;
      documentosPendientes: boolean;
      venceDocumentos: string | null;
      definitiva: boolean;
      predio: { id: string; nombre: string; tipoPredio: TipoPredio };
      fechaVisita: string;
      inspector: { nombreCompleto: string };
    }>(`${this.base}/modulo7/visitas/${visitaId}/resultados`);
  }

  cerrarVisita(visitaId: string, datos: {
    grupoProductivo: GrupoProductivo;
    respuestas: { indicadorId: string; puntaje: number; observacion?: string }[];
    documentosPendientes: boolean;
    correoResponsable?: string;
    firmaBase64: string;
  }): Observable<ResultadoVisita> {
    return this.http.post<ResultadoVisita>(
      `${this.base}/modulo7/visitas/${visitaId}/cerrar`,
      datos,
    );
  }

  recibirDocumentos(
    visitaId: string,
    respuestas: { indicadorId: string; puntaje: number }[],
  ): Observable<ResultadoVisita> {
    return this.http.patch<ResultadoVisita>(
      `${this.base}/modulo7/visitas/${visitaId}/documentos`,
      { respuestas },
    );
  }

  auditoria(): Observable<EventoAuditoria[]> {
    return this.http.get<EventoAuditoria[]>(`${this.base}/modulo8/auditoria`);
  }

  comparar(predioId: string): Observable<{
    visitaId: string;
    fecha: string;
    calificacion: number;
    clasificacion: string;
    grupos: ResultadoVisita['grupos'];
  }[]> {
    return this.http.get<{
      visitaId: string;
      fecha: string;
      calificacion: number;
      clasificacion: string;
      grupos: ResultadoVisita['grupos'];
    }[]>(`${this.base}/modulo7/predios/${predioId}/comparacion`);
  }

  enviarActa(visitaId: string, correo?: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.base}/modulo7/visitas/${visitaId}/enviar`,
      correo ? { correo } : {},
    );
  }

  descargarHistorial(formato: 'csv' | 'xlsx' | 'pdf'): Observable<Blob> {
    return this.http.get(`${this.base}/modulo7/exportar?formato=${formato}`, {
      responseType: 'blob',
    });
  }

  descargarActa(visitaId: string): Observable<Blob> {
    return this.http.get(`${this.base}/modulo7/visitas/${visitaId}/acta`, {
      responseType: 'blob',
    });
  }
}
