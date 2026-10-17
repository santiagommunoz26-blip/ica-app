# ADR-001 · Modelo de datos de la metodología y de las respuestas

- **Estado:** Aceptada
- **Fecha:** 15 de octubre de 2026
- **Decide:** desarrollador del proyecto (Santiago Muñoz), a partir de los documentos de requisitos
- **Requisitos relacionados:** RF13, RF17, RF23, RF25, RF34–RF38, RF46–RF49, RNF17, RNF18, RNF21, RNF27

## Contexto

La metodología ICA tiene una parte **configurable**: indicadores, escalas de puntaje (0/1/2),
rangos de muestra, grupos de medidas y pesos. Los requisitos lo exigen explícitamente:

- «Los indicadores, las escalas, los pesos y los rangos no deben quedar fijos en el código.
  Deben poder configurarse desde el catálogo» (RF49).
- «El sistema debe permitir al administrador modificar los pesos de los grupos de medidas para
  corral y para traspatio, y **validar que sumen 100 %**» (RF48).
- «Un cambio debe crear una versión nueva **sin alterar las visitas ya cerradas**» (RF49).
- «La plataforma debe soportar el versionamiento de la metodología, de modo que una visita
  siempre se calcule con la versión vigente al momento de realizarla» (RNF18).
- Pesos vigentes en la metodología: corral = 35 % animal (MBA) / 35 % recursos (MBR) / 30 %
  gestión (MBG); traspatio = 60 % animal / 40 % recursos (RF13, RF16).
- Además, el administrador edita catálogo, escalas y pesos desde la aplicación (RF46–RF48) y
  hay que consultar indicadores concretos para reportes y priorización (RF40).

Es decir, conviven **dos naturalezas de datos**: el catálogo (estructurado, editable, validado y
versionado) y las respuestas de cada visita (semi-estructuradas, muchas, inmutables una vez
cerrada la visita).

## Opciones evaluadas

1. **Todo en JSONB** (catálogo y respuestas como documentos JSON).
2. **Todo normalizado** (tablas relacionales para catálogo y respuestas).
3. **Event sourcing** (los cambios del catálogo y de las respuestas como eventos).
4. **Híbrida**: catálogo normalizado y versionado + respuestas de la visita en JSONB con copia
   (snapshot) de la versión usada.

## Decisión

Se adopta la **opción 4 (híbrida)**:

- **Catálogo normalizado y versionado** en PostgreSQL: `metodologia_version`, `grupo_medida`,
  `indicador`, `escala_indicador`, `peso_grupo`, `tipo_pregunta`… con claves foráneas y
  restricciones. Los pesos por conjunto de grupos se validan con una restricción/consulta que
  exige suma 100 %.
- **Respuestas de la visita en JSONB** (`evaluacion.respuestas`), incluyendo el `metodologia_version_id`
  usado y un **snapshot del catálogo aplicable** (pesos, escalas y umbrales vigentes en ese momento).
- Los indicadores y sus escalas se resuelven por consulta al catálogo; **nada de reglas
  metodológicas en el código**.

## Justificación

- El catálogo necesita **integridad fuerte** (pesos que suman 100 %, indicador perteneciente a un
  grupo, aplicación por grupo productivo): eso se expresa mucho mejor con tablas y restricciones.
- Las respuestas son **semi-estructuradas** y su forma depende del tipo de pregunta
  (sí/no, única, múltiple, escala, numérica, textual, evidencia): en tablas exigiría un esquema
  EAV (entidad-atributo-valor) o decenas de columnas nulas.
- El **snapshot por visita** garantiza el requisito de inmutabilidad (RF49/RNF18) sin necesidad de
  duplicar catálogos completos ni de impedir la evolución de la metodología.
- El cálculo (RF34–RF36) es aritmético y acotado; no requiere el histórico de eventos.

## Consecuencias

- **Positivas:** catálogo validado y auditable; visitas cerradas inmutables; consultas de reportes
  por indicador/grupo eficientes; posibilidad de índices GIN sobre `respuestas` si hace falta.
- **Negativas:** hay que mantener dos caminos de lectura (relacional + JSONB) y versionar el
  catálogo con cuidado (nueva versión, nunca edición destructiva).
- **Pendientes:**
  - Confirmar con el docente si además de «grupo de medidas → indicador» existe un nivel
    intermedio de criterios/subcriterios: los documentos fuente **no** mencionan «subcriterio»
    (el plan de sprint sí lo mencionaba; queda por confirmar).
  - El manual ICA EBA v2.0 (2024) se recibió y sus 55 escalas se resumieron en la migración `1792454400000-seed-ica-verified-scales`. Las 14 escalas que solo definen 0 y 2 marcan 1 como no aplicable; M7 no ofrece ni acepta ese puntaje. La versión se crea sin modificar versiones ni snapshots de actas anteriores. Las paráfrasis deben cotejarse con el manual antes de uso regulatorio/productivo.
- Event sourcing y «todo JSONB» se descartan por complejidad/costos frente al alcance académico.

## Nota de verificación

El modelo se probó en el spike `docs/spike-form-engine/` (validación de pesos que suman 100 %,
cálculo del indicador, de los grupos y clasificación final).
