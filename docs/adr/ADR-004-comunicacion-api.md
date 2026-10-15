# ADR-004 · Comunicación entre frontend y backend

- **Estado:** Aceptada
- **Fecha:** 15 de octubre de 2026
- **Decide:** desarrollador del proyecto (Santiago Muñoz)
- **Requisitos relacionados:** RNF01, RNF03, RNF04, RNF05, RNFG04, RNF27, RF12

## Contexto

- «La solución debe implementarse como **aplicación web** con frontend en **Angular**» (RNF01) y el
  backend es **Node.js + NestJS**.
- La plataforma debe **integrarse con APIs externas**, en particular con **servicios de IA**
  (RNFG04), y debe permitir que «nuevos grupos de estudiantes agreguen nuevas especies, reglas o
  funcionalidades sin afectar lo construido» (RNF27).
- Hay que soportar **trabajo sin conexión** con sincronización diferida (RF12, RNF02).
- Los cálculos deben ser precisos y responderse en tiempos acotados (RNF03, RNF04) y la navegación
  debe ser ágil (RNF05).
- El proyecto es **académico y colaborativo**: conviene que el contrato de la API sea explícito y
  fácil de consumir por terceros (otros grupos, docentes) y de documentar.

## Opciones evaluadas

1. **REST + OpenAPI (Swagger)**.
2. **GraphQL**.
3. **tRPC**.

## Decisión

Se adopta **REST + OpenAPI**:

- API **REST** versionada (`/api/v1/...`) implementada con controladores de NestJS.
- Especificación **OpenAPI 3** generada automáticamente y publicada en `/api/docs` (Swagger UI).
- **DTO y validación** de entrada con `class-validator`/`class-transformer`, de modo que el contrato
  sea el mismo que se documenta.
- Respuestas **paginadas y con códigos de error consistentes** (para el manejo de reintentos y de la
  cola offline del frontend).

## Justificación

- NestJS y Angular tienen soporte de primera clase para REST y para OpenAPI: es el camino con menos
  fricción y con mejor integración con el ecosistema del curso.
- GraphQL añadiría un servidor y un modelo de consultas que **no** resuelven ninguna necesidad actual
  (las pantallas consumen recursos bien definidos) y complicaría el cacheo offline.
- tRPC acopla frontend y backend a TypeScript y a un cliente propietario, lo que dificulta que otros
  grupos o sistemas consuman la API (RNF27).
- REST encaja mejor con **caché HTTP y sincronización por lotes**, necesarios para el modo offline
  (RF12), y con las integraciones externas de IA (RNFG04).

## Consecuencias

- **Positivas:** contrato público y documentado; pruebas e2e sencillas; integraciones externas
  simples; crecimiento por recursos sin romper lo existente (versionado `/v1`).
- **Negativas:** puede haber **sobre-consulta** (varias llamadas para una pantalla); se mitiga con
  endpoints de resumen (p. ej. el tablero de RF08/RF09) y con paginación.
- **Pendientes:**
  - Definir la estrategia concreta de **sincronización por lotes** (endpoint de push de registros
    locales, resolución de conflictos, idempotencia por identificador local). Se detallará en M2.
  - Definir la política de **versionado** de la API cuando cambie el contrato.
