import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { VisitasService } from './visitas.service';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO_PREDIO,
  TRANSICIONES_ESTADO,
  type EstadoVisita,
  type FiltrosVisitas,
  type ListaVisitas,
  type OperacionSincronizacion,
  type PeticionActualizarVisita,
  type PeticionCrearVisita,
  type Predio,
  type ResumenPanel,
  type ResultadoSincronizacion,
  type Visita,
} from './visitas.modelos';

/** Claves del almacenamiento local del equipo. */
const CLAVE_COLA = 'ica.visitas.cola';
const CLAVE_CACHE = 'ica.visitas.cache';
const CLAVE_RESUMEN = 'ica.visitas.resumen';
const CLAVE_FILTROS = 'ica.visitas.filtros';

/** Resultado de guardar un cambio: si quedó pendiente de enviar. */
export interface ResultadoGuardado {
  /** Verdadero si el cambio quedó guardado solo en el equipo (RF12). */
  pendiente: boolean;
  /** Motivos por los que el servidor rechazó alguna operación, si hubo. */
  rechazos: string[];
}

/**
 * Guarda los datos en el equipo y los sincroniza (M2 · RF12).
 *
 * Funcionamiento:
 * 1. Cada cambio (programar, editar, cambiar de estado) se **guarda primero en
 *    el equipo**, así no se pierde si falla la red o se cierra la aplicación.
 * 2. Si hay conexión, se envían de inmediato las operaciones pendientes; si no,
 *    se quedan en la cola y se reintentan cuando vuelva la conexión.
 * 3. La lista y los indicadores del panel se guardan como copia local, para
 *    poder consultarlos sin conexión.
 *
 * El servidor decide: las operaciones que rechaza (por ejemplo, cambiar una
 * visita que allá ya está cerrada) se quitan de la cola y se informan.
 */
@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private readonly http = inject(VisitasService);
  private readonly auth = inject(AuthService);

  /** ¿Hay conexión? Se actualiza con los avisos del navegador. */
  readonly enLinea = signal<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  /** Operaciones guardadas en el equipo que aún no llegaron al servidor. */
  readonly cola = signal<OperacionSincronizacion[]>([]);
  /** Cuántos registros faltan por sincronizar (RF12). */
  readonly pendientes = computed(() => this.cola().length);
  /** Verdadero mientras se está enviando la cola. */
  readonly sincronizando = signal(false);
  /** Resultado de la última sincronización, para informar al usuario. */
  readonly ultimoResultado = signal<ResultadoSincronizacion[] | null>(null);
  /** Última lista consultada, para poder verla sin conexión. */
  readonly listaLocal = signal<ListaVisitas | null>(null);
  /** Últimos indicadores del panel, para poder verlos sin conexión. */
  readonly resumenLocal = signal<ResumenPanel | null>(null);

  private filtrosUsados: FiltrosVisitas = {};

  constructor() {
    this.cola.set(leer<OperacionSincronizacion[]>(CLAVE_COLA) ?? []);
    this.listaLocal.set(leer<ListaVisitas>(CLAVE_CACHE));
    this.resumenLocal.set(leer<ResumenPanel>(CLAVE_RESUMEN));
    this.filtrosUsados = leer<FiltrosVisitas>(CLAVE_FILTROS) ?? {};

    if (typeof window !== 'undefined') {
      const alVolverLaRed = () => {
        this.enLinea.set(true);
        // Al volver la conexión se envían solas las operaciones pendientes.
        void this.sincronizar();
      };
      const alPerderLaRed = () => this.enLinea.set(false);

      window.addEventListener('online', alVolverLaRed);
      window.addEventListener('offline', alPerderLaRed);
      // Los avisos se sueltan al destruirse el servicio: nadie queda escuchando.
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('online', alVolverLaRed);
        window.removeEventListener('offline', alPerderLaRed);
      });
    }
  }

  // ------------------------------------------------------------- consulta

  /**
   * Lista las visitas. Con conexión pregunta al servidor y guarda la copia;
   * sin conexión (o si el servidor no responde) usa la copia del equipo. En
   * ambos casos se aplican encima los cambios que aún no se han sincronizado.
   */
  async listar(filtros: FiltrosVisitas = {}): Promise<ListaVisitas> {
    this.filtrosUsados = filtros;
    guardar(CLAVE_FILTROS, filtros);

    if (this.enLinea()) {
      try {
        const lista = await this.conAcceso(() => this.http.listar(filtros));
        guardar(CLAVE_CACHE, lista);
        this.listaLocal.set(lista);
        return this.proyectar(lista);
      } catch {
        // Si la petición falla se sigue con lo que hay en el equipo.
      }
    }

    return this.proyectar(this.listaLocal() ?? vacia(filtros));
  }

  /** Indicadores del panel (RF10), con la copia del equipo como respaldo. */
  async cargarResumen(): Promise<ResumenPanel | null> {
    if (this.enLinea()) {
      try {
        const resumen = await this.conAcceso(() => this.http.resumen());
        guardar(CLAVE_RESUMEN, resumen);
        this.resumenLocal.set(resumen);
        return resumen;
      } catch {
        // Se muestra el último resumen guardado.
      }
    }
    return this.resumenLocal();
  }

  /** Predios registrados (para el formulario); sin conexión, sin lista. */
  async cargarPredios(busqueda?: string): Promise<Predio[]> {
    if (!this.enLinea()) return [];
    try {
      return await this.conAcceso(() => this.http.predios(busqueda));
    } catch {
      return [];
    }
  }

  /** Municipios ya usados (para el filtro); sin conexión, sin lista. */
  async cargarMunicipios(): Promise<string[]> {
    if (!this.enLinea()) return [];
    try {
      return await this.conAcceso(() => this.http.municipios());
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------- cambios

  /** Programa una visita (RF08). Se guarda en el equipo antes de enviarla. */
  async programar(peticion: PeticionCrearVisita): Promise<ResultadoGuardado> {
    const id = peticion.id ?? nuevoId();
    const completa: PeticionCrearVisita = { ...peticion, id };
    return this.encolar({
      id: nuevoId(),
      tipo: 'CREAR_VISITA',
      visitaId: id,
      crear: completa,
      registradoEn: new Date().toISOString(),
      resumen: `Programar visita en ${peticion.predio?.nombre ?? 'el predio'}`,
    });
  }

  /** Edita una visita programada. */
  async editar(
    id: string,
    cambios: PeticionActualizarVisita,
    etiqueta = 'Editar visita',
  ): Promise<ResultadoGuardado> {
    return this.encolar({
      id: nuevoId(),
      tipo: 'ACTUALIZAR_VISITA',
      visitaId: id,
      actualizar: cambios,
      registradoEn: new Date().toISOString(),
      resumen: etiqueta,
    });
  }

  /** Cambia el estado de una visita (RF09). */
  async cambiarEstado(
    visita: Visita,
    estado: EstadoVisita,
  ): Promise<ResultadoGuardado> {
    return this.encolar({
      id: nuevoId(),
      tipo: 'CAMBIAR_ESTADO',
      visitaId: visita.id,
      estado: { estado },
      registradoEn: new Date().toISOString(),
      resumen: `${visita.predio.nombre}: ${ETIQUETA_ESTADO[estado]}`,
    });
  }

  /** Guarda la operación en el equipo e intenta enviarla si hay conexión. */
  private async encolar(
    operacion: OperacionSincronizacion,
  ): Promise<ResultadoGuardado> {
    this.guardarCola([...this.cola(), operacion]);

    if (!this.enLinea()) return { pendiente: true, rechazos: [] };

    try {
      const resultados = await this.sincronizar();
      const rechazos = resultados
        .filter((resultado) => resultado.estado === 'RECHAZADA')
        .map((resultado) => resultado.motivo ?? 'Operación rechazada.');
      return { pendiente: false, rechazos };
    } catch {
      // Sin red: la operación ya está guardada y se enviará después.
      return { pendiente: true, rechazos: [] };
    }
  }

  /**
   * Envía las operaciones pendientes (RF12). Las que el servidor aplica y las
   * que rechaza salen de la cola: reintentar un rechazo no cambiaría nada.
   */
  async sincronizar(): Promise<ResultadoSincronizacion[]> {
    const operaciones = this.cola();
    if (operaciones.length === 0 || !this.enLinea()) return [];

    this.sincronizando.set(true);
    try {
      const respuesta = await this.conAcceso(() =>
        this.http.sincronizar(operaciones.map(aServidor)),
      );

      const enviadas = new Set(operaciones.map((operacion) => operacion.id));
      this.guardarCola(
        this.cola().filter((operacion) => !enviadas.has(operacion.id)),
      );
      this.ultimoResultado.set(respuesta.resultados);

      // La copia local se refresca con el estado que quedó en el servidor.
      try {
        const lista = await this.conAcceso(() =>
          this.http.listar(this.filtrosUsados),
        );
        guardar(CLAVE_CACHE, lista);
        this.listaLocal.set(lista);
      } catch {
        // Si falla, la próxima consulta traerá el estado bueno.
      }

      return respuesta.resultados;
    } finally {
      this.sincronizando.set(false);
    }
  }

  // ------------------------------------------------------------- internos

  /** Renueva el token si hace falta y ejecuta la petición. */
  private async conAcceso<T>(peticion: () => Observable<T>): Promise<T> {
    await firstValueFrom(this.auth.asegurarAcceso());
    return firstValueFrom(peticion());
  }

  private guardarCola(cola: OperacionSincronizacion[]): void {
    this.cola.set(cola);
    guardar(CLAVE_COLA, cola);
  }

  /** Aplica los cambios pendientes sobre lo que devolvió el servidor. */
  private proyectar(lista: ListaVisitas): ListaVisitas {
    const operaciones = this.cola();
    if (operaciones.length === 0) return lista;

    const datos = [...lista.datos];
    let agregadas = 0;

    for (const operacion of operaciones) {
      switch (operacion.tipo) {
        case 'CREAR_VISITA': {
          const id = operacion.visitaId ?? operacion.crear?.id;
          if (!id || datos.some((visita) => visita.id === id)) break;
          const local = this.visitaLocal(operacion);
          if (local) {
            datos.unshift(local);
            agregadas += 1;
          }
          break;
        }
        case 'ACTUALIZAR_VISITA': {
          const indice = datos.findIndex(
            (visita) => visita.id === operacion.visitaId,
          );
          if (indice >= 0 && operacion.actualizar) {
            datos[indice] = conCambios(datos[indice], operacion.actualizar);
          }
          break;
        }
        case 'CAMBIAR_ESTADO': {
          const indice = datos.findIndex(
            (visita) => visita.id === operacion.visitaId,
          );
          if (indice >= 0 && operacion.estado) {
            datos[indice] = conEstado(datos[indice], operacion.estado.estado);
          }
          break;
        }
      }
    }

    if (agregadas === 0) return { ...lista, datos };

    return {
      ...lista,
      datos,
      total: lista.total + agregadas,
      conteos: {
        ...lista.conteos,
        todas: lista.conteos.todas + agregadas,
        programadas: lista.conteos.programadas + agregadas,
      },
    };
  }

  /** Arma la visita que se ve mientras no llega al servidor. */
  private visitaLocal(operacion: OperacionSincronizacion): Visita | null {
    const peticion = operacion.crear;
    const id = operacion.visitaId ?? peticion?.id;
    if (!peticion || !id) return null;

    const usuario = this.auth.usuario();
    const predio: Predio = {
      id: `local-${id}`,
      nombre: peticion.predio?.nombre ?? 'Predio sin nombre',
      municipio: peticion.predio?.municipio ?? '',
      vereda: peticion.predio?.vereda ?? '',
      tipoPredio: peticion.predio?.tipoPredio ?? 'CORRAL',
      etiquetaTipoPredio:
        ETIQUETA_TIPO_PREDIO[peticion.predio?.tipoPredio ?? 'CORRAL'],
    };

    return {
      id,
      predio,
      inspector: {
        id: usuario?.id ?? '',
        nombreCompleto: usuario?.nombreCompleto ?? 'Inspector',
      },
      programadaPara: peticion.programadaPara,
      estado: 'PROGRAMADA',
      etiquetaEstado: ETIQUETA_ESTADO.PROGRAMADA,
      observaciones: peticion.observaciones ?? null,
      calificacion: null,
      clasificacion: null,
      etiquetaClasificacion: null,
      editable: true,
      accionesPosibles: [...TRANSICIONES_ESTADO.PROGRAMADA],
      createdAt: operacion.registradoEn,
      updatedAt: operacion.registradoEn,
      pendiente: true,
    };
  }
}

/** Quita del envío los campos que son solo para la pantalla. */
function aServidor(operacion: OperacionSincronizacion): unknown {
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    visitaId: operacion.visitaId,
    crear: operacion.crear,
    actualizar: operacion.actualizar,
    estado: operacion.estado,
    registradoEn: operacion.registradoEn,
  };
}

/** Aplica los cambios de una edición sobre la visita que se muestra. */
function conCambios(visita: Visita, cambios: PeticionActualizarVisita): Visita {
  return {
    ...visita,
    programadaPara: cambios.programadaPara ?? visita.programadaPara,
    observaciones:
      cambios.observaciones !== undefined
        ? cambios.observaciones
        : visita.observaciones,
    pendiente: true,
  };
}

/** Pone la visita en otro estado, como lo hará el servidor. */
function conEstado(visita: Visita, estado: EstadoVisita): Visita {
  return {
    ...visita,
    estado,
    etiquetaEstado: ETIQUETA_ESTADO[estado],
    // Una visita cerrada no se edita (RF09).
    editable: estado === 'CERRADA' ? false : visita.editable,
    accionesPosibles: [...TRANSICIONES_ESTADO[estado]],
    pendiente: true,
  };
}

/** Lista vacía con los filtros pedidos. */
function vacia(filtros: FiltrosVisitas): ListaVisitas {
  return {
    datos: [],
    total: 0,
    pagina: filtros.pagina ?? 1,
    porPagina: filtros.porPagina ?? 20,
    conteos: {
      todas: 0,
      programadas: 0,
      enCurso: 0,
      pendientesDocumentos: 0,
      cerradas: 0,
    },
  };
}

/** Identificador local (el servidor lo acepta para no duplicar, RF12). */
function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caracter) => {
    const aleatorio = (Math.random() * 16) | 0;
    const valor = caracter === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}

/** Lee un valor del almacenamiento del equipo. */
function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

/** Escribe un valor en el almacenamiento del equipo. */
function guardar(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible se sigue funcionando en memoria.
  }
}
