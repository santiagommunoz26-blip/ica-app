# Decisiones de arquitectura (ADRs)

Registro de las decisiones técnicas del proyecto y de **por qué** se tomaron, con las
alternativas descartadas y lo que queda pendiente. Cada ADR se apoya en los requisitos
(RF/RNF) de los documentos fuente y es revisable: si cambia el contexto, se escribe un ADR
nuevo que reemplace al anterior (no se reescribe la historia).

| ADR                                                  | Tema                                     | Decisión                                         | Estado   |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ | -------- |
| [ADR-001](ADR-001-modelo-datos-formularios.md)       | Modelo de datos de formularios dinámicos | Catálogo normalizado + respuestas en JSONB       | Aceptada |
| [ADR-002](ADR-002-autenticacion.md)                  | Autenticación                            | JWT propio (NestJS + Passport) + PIN offline     | Aceptada |
| [ADR-003](ADR-003-almacenamiento-evidencias.md)      | Almacenamiento de evidencias             | URLs firmadas a Cloud Storage / MinIO            | Aceptada |
| [ADR-004](ADR-004-comunicacion-api.md)               | Comunicación frontend–backend            | REST + OpenAPI                                   | Aceptada |
| [ADR-005](ADR-005-despliegue-gcp.md)                 | Despliegue en Google Cloud               | Cloud Run + Cloud SQL + Cloud Storage + Firebase | Aceptada |

## Plantilla usada

Cada ADR contiene: **Estado**, **Fecha**, **Decide**, **Requisitos relacionados**, **Contexto**,
**Opciones evaluadas**, **Decisión**, **Justificación**, **Consecuencias** y **Pendientes**.

## Puntos abiertos que cruzan varias ADRs

- Documento fuente de la **metodología ICA v2.0 (2024)**: aún no se tiene; de él dependen el
  catálogo real de indicadores, escalas y tamaños de muestra.
- Alcance concreto de las **recomendaciones con IA** (el documento del curso las fija en RNFG04;
  el alcance funcional exacto está por confirmar).
- **Cuenta/proyecto de Google Cloud** a utilizar y su presupuesto.
