import { HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { fase4Vacia } from '../inspeccion/cierre.modelos';
import { InspeccionService } from '../inspeccion/inspeccion.service';
import {
  aplicarBorrador,
  fusionarPeticiones,
  type InspeccionRespuesta,
  type PeticionGuardarInspeccion,
} from '../inspeccion/inspeccion.modelos';
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
const CLAVE_INSPECCION = 'ica.inspeccion.cache';

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
  private readonly inspeccionHttp = inject(InspeccionService);
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
  /** Últimas fichas de inspección consultadas, por visita (M3 · RF13–RF17). */
  readonly inspeccionesLocales = signal<Record<string, InspeccionRespuesta>>(
    {},
  );

  private filtrosUsados: FiltrosVisitas = {};

  constructor() {
    this.cola.set(leer<OperacionSincronizacion[]>(CLAVE_COLA) ?? []);
    this.listaLocal.set(leer<ListaVisitas>(CLAVE_CACHE));
    this.resumenLocal.set(leer<ResumenPanel>(CLAVE_RESUMEN));
    this.inspeccionesLocales.set(
      leer<Record<string, InspeccionRespuesta>>(CLAVE_INSPECCION) ?? {},
    );
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

  /**
   * Ficha general y catálogo de una visita (M3 · RF13–RF17). Con conexión
   * pregunta al servidor y guarda la copia; sin conexión usa la copia del
   * equipo. En ambos casos aplica encima los borradores aún sin sincronizar.
   */
  async cargarInspeccion(
    visitaId: string,
  ): Promise<InspeccionRespuesta | null> {
    if (this.enLinea()) {
      try {
        const respuesta = await this.conAcceso(() =>
          this.inspeccionHttp.obtener(visitaId),
        );
        this.guardarInspeccionLocal(visitaId, respuesta);
        return this.proyectarInspeccion(visitaId, respuesta);
      } catch {
        // Si la petición falla se sigue con lo que hay en el equipo.
      }
    }

    const local = this.inspeccionesLocales()[visitaId];
    return local ? this.proyectarInspeccion(visitaId, local) : null;
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

  /**
   * Marca el inicio de la inspección: la visita pasa a «En curso» (RF09).
   * Reutiliza la operación de cambio de estado, para que también funcione sin
   * conexión (RF12).
   */
  async iniciarInspeccion(
    visitaId: string,
    nombrePredio: string,
  ): Promise<ResultadoGuardado> {
    return this.encolar({
      id: nuevoId(),
      tipo: 'CAMBIAR_ESTADO',
      visitaId,
      estado: { estado: 'EN_CURSO' },
      registradoEn: new Date().toISOString(),
      resumen: `${nombrePredio}: ${ETIQUETA_ESTADO.EN_CURSO}`,
    });
  }

  /**
   * Guarda la ficha de la Fase I y las evaluaciones de la Fase II (M3–M4 ·
   * RF12–RF26). Como el resto de cambios, primero queda en el equipo y luego
   * se envía (RF12); sin conexión se ve el borrador aplicado sobre la copia
   * local.
   *
   * Si ya hay un borrador de esta inspección sin enviar, se funde con él: la
   * última versión contiene todo lo anterior y así la cola no acumula una
   * copia completa de la ficha por cada guardado (RF26).
   */
  async guardarInspeccion(
    visitaId: string,
    peticion: PeticionGuardarInspeccion,
  ): Promise<ResultadoGuardado> {
    const actual = this.inspeccionesLocales()[visitaId];
    if (actual) {
      this.guardarInspeccionLocal(visitaId, aplicarBorrador(actual, peticion));
    }

    const cola = this.cola();
    const pendiente = cola.find(
      (operacion) =>
        operacion.tipo === 'GUARDAR_INSPECCION' &&
        operacion.visitaId === visitaId &&
        operacion.inspeccion,
    );

    if (pendiente?.inspeccion) {
      const fundida: OperacionSincronizacion = {
        ...pendiente,
        // Identificador nuevo: si la anterior ya iba en un envío en curso, no
        // se pierde al retirar las enviadas de la cola.
        id: nuevoId(),
        inspeccion: fusionarPeticiones(pendiente.inspeccion, peticion),
        registradoEn: new Date().toISOString(),
      };
      this.guardarCola(
        cola.map((operacion) =>
          operacion === pendiente ? fundida : operacion,
        ),
      );
      return this.enviarSiHayRed();
    }

    return this.encolar({
      id: nuevoId(),
      tipo: 'GUARDAR_INSPECCION',
      visitaId,
      inspeccion: peticion,
      registradoEn: new Date().toISOString(),
      resumen: 'Guardar la ficha de la inspección',
    });
  }

  /** Guarda la operación en el equipo e intenta enviarla si hay conexión. */
  private async encolar(
    operacion: OperacionSincronizacion,
  ): Promise<ResultadoGuardado> {
    this.guardarCola([...this.cola(), operacion]);
    return this.enviarSiHayRed();
  }

  /** Envía lo que haya pendiente cuando hay red; si falla, queda en la cola. */
  private async enviarSiHayRed(): Promise<ResultadoGuardado> {
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
   *
   * El servidor valida el lote entero de una vez: si una sola operación no
   * cumple su contrato (error 400), ninguna se aplica. En ese caso se
   * reintenta operación por operación, para que las que están bien no queden
   * bloqueadas por una mal formada.
   */
  async sincronizar(): Promise<ResultadoSincronizacion[]> {
    const operaciones = this.cola();
    if (operaciones.length === 0 || !this.enLinea()) return [];

    this.sincronizando.set(true);
    try {
      let resultados: ResultadoSincronizacion[];
      try {
        const respuesta = await this.conAcceso(() =>
          this.http.sincronizar(operaciones.map(aServidor)),
        );
        resultados = respuesta.resultados;
      } catch (fallo) {
        if (!(fallo instanceof HttpErrorResponse) || fallo.status !== 400) {
          throw fallo;
        }
        resultados = await this.sincronizarUnaPorUna(operaciones);
      }

      const enviadas = new Set(operaciones.map((operacion) => operacion.id));
      this.guardarCola(
        this.cola().filter((operacion) => !enviadas.has(operacion.id)),
      );
      this.ultimoResultado.set(resultados);

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

      return resultados;
    } finally {
      this.sincronizando.set(false);
    }
  }

  /**
   * Envía las operaciones una por una (cuando el lote fue rechazado por
   * formato). Las que el servidor rechaza por su contenido se informan y salen
   * de la cola; un fallo de red detiene el proceso y deja el resto pendiente.
   */
  private async sincronizarUnaPorUna(
    operaciones: OperacionSincronizacion[],
  ): Promise<ResultadoSincronizacion[]> {
    const resultados: ResultadoSincronizacion[] = [];
    for (const operacion of operaciones) {
      try {
        const respuesta = await this.conAcceso(() =>
          this.http.sincronizar([aServidor(operacion)]),
        );
        resultados.push(...respuesta.resultados);
      } catch (fallo) {
        if (fallo instanceof HttpErrorResponse && fallo.status === 400) {
          resultados.push({
            id: operacion.id,
            estado: 'RECHAZADA',
            motivo:
              'La operación no tiene el formato que espera el servidor y no se pudo aplicar.',
          });
          continue;
        }
        throw fallo;
      }
    }
    return resultados;
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

  /** Guarda la copia local de una ficha de inspección (M3 · RF12). */
  private guardarInspeccionLocal(
    visitaId: string,
    respuesta: InspeccionRespuesta,
  ): void {
    const mapa = { ...this.inspeccionesLocales(), [visitaId]: respuesta };
    this.inspeccionesLocales.set(mapa);
    guardar(CLAVE_INSPECCION, mapa);
  }

  /** Aplica los borradores pendientes sobre la ficha que se muestra (RF12). */
  private proyectarInspeccion(
    visitaId: string,
    respuesta: InspeccionRespuesta,
  ): InspeccionRespuesta {
    // Una copia guardada por una versión anterior al cierre (M7) puede no
    // traer el bloque de la Fase IV; se completa vacío para que la pantalla
    // del cierre no falle.
    let resultado: InspeccionRespuesta = {
      ...respuesta,
      fase4: respuesta.fase4 ?? fase4Vacia(),
    };
    for (const operacion of this.cola()) {
      if (
        operacion.tipo === 'GUARDAR_INSPECCION' &&
        operacion.visitaId === visitaId &&
        operacion.inspeccion
      ) {
        resultado = aplicarBorrador(resultado, operacion.inspeccion);
      }
    }
    return resultado;
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

/**
 * Quita del envío los campos que son solo para la pantalla o para el cálculo
 * local (RF26): `resumen` y, dentro de la ficha, `guardadoEn` de cada
 * evaluación y documento. El servidor valida el cuerpo contra su contrato y
 * rechaza los campos que no declara, así que aquí solo viaja lo que espera.
 */
function aServidor(operacion: OperacionSincronizacion): unknown {
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    visitaId: operacion.visitaId,
    crear: operacion.crear,
    actualizar: operacion.actualizar,
    estado: operacion.estado,
    inspeccion: operacion.inspeccion
      ? aFichaDeServidor(operacion.inspeccion)
      : undefined,
    registradoEn: operacion.registradoEn,
  };
}

/** Arma la ficha como la espera la API (sin los campos de pantalla). */
function aFichaDeServidor(
  inspeccion: PeticionGuardarInspeccion,
): Record<string, unknown> {
  const { evaluaciones, documentos, ...ficha } = inspeccion;
  const enviada: Record<string, unknown> = { ...ficha };

  if (evaluaciones) {
    enviada['evaluaciones'] = evaluaciones.map((evaluacion) => ({
      galponNumero: evaluacion.galponNumero,
      indicadorCodigo: evaluacion.indicadorCodigo,
      noAplica: evaluacion.noAplica,
      motivoNoAplica: evaluacion.motivoNoAplica,
      observaciones: evaluacion.observaciones,
      puntos: evaluacion.puntos.map((punto) => ({
        numero: punto.numero,
        puntaje: punto.puntaje,
        aves: punto.aves,
        jaulas: punto.jaulas,
      })),
    }));
  }

  if (documentos) {
    enviada['documentos'] = documentos.map((documento) => ({
      indicadorCodigo: documento.indicadorCodigo,
      presentado: documento.presentado,
      legible: documento.legible,
      firmadoResponsable: documento.firmadoResponsable,
      firmadoProfesional: documento.firmadoProfesional,
      mortalidad: documento.mortalidad,
      puntaje: documento.puntaje,
      pendiente: documento.pendiente,
    }));
  }

  return enviada;
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
