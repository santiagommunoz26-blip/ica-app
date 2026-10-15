# ADR-005 · Despliegue en Google Cloud

- **Estado:** Aceptada
- **Fecha:** 15 de octubre de 2026
- **Decide:** desarrollador del proyecto (Santiago Muñoz)
- **Requisitos relacionados:** RNFG01, RNFG02, RNFG03, RNFG04, RNFG05, RNFG06, RNFG07, RNF23, RNF25, RNF26

## Contexto

- «La solución debe **desplegarse sobre servicios administrados de Google Cloud**» (RNFG01).
- La información estructurada debe residir en una **base de datos gestionada** (RNFG03), las
  evidencias en un **almacenamiento escalable** (RNFG02) y debe existir integración con **servicios
  de IA** (RNFG04).
- Debe haber **monitoreo y registro de eventos** (RNFG05, RNF25), **CI/CD** (RNF23) y
  **portabilidad entre ambientes** (RNF26), además de **ambientes separados** de desarrollo, pruebas
  y producción (RNFG07).
- Las credenciales y llaves **no** deben quedar embebidas en el código (RNFG06).
- Restricciones reales del proyecto: es **académico**, con **presupuesto limitado** y mantenido por
  un equipo pequeño; ya existe un entorno local con **Docker Compose** (PostgreSQL, Redis, MinIO) y
  el backend se empaqueta como contenedor.
- El docente sugiere: base de datos Cloud SQL (o Firebase), archivos en Cloud Storage, monitoreo con
  las herramientas de Google Cloud, y despliegue en servicios administrados.

## Opciones evaluadas

1. **Cloud Run** (contenedores administrados, escala a cero) + frontend estático administrado.
2. **GKE Autopilot** (Kubernetes administrado).
3. **Cloud Functions** (funciones por demanda).
4. App Engine (mencionada como alternativa).

## Decisión

Se adopta la **opción 1**, con este reparto:

| Componente        | Servicio propuesto                                                                 |
| ----------------- | ---------------------------------------------------------------------------------- |
| Backend (NestJS)  | **Cloud Run** (contenedor) + **Artifact Registry**                                 |
| Frontend (Angular)| **Firebase Hosting** (estático, CDN incluida); alternativa: bucket + Cloud CDN     |
| Base de datos     | **Cloud SQL for PostgreSQL** (conector de Cloud Run)                               |
| Evidencias        | **Cloud Storage** (bucket privado + URLs firmadas, ver ADR-003)                     |
| Secretos          | **Secret Manager**                                                                 |
| Observabilidad    | **Cloud Logging** + **Cloud Monitoring** (+ alertas)                               |
| CI/CD             | **GitHub Actions** (ya configurado) → Artifact Registry → Cloud Run                |
| IA                | API de IA administrada (Vertex AI / Gemini), consumida desde el backend            |

- Ambientes **separados** (RNFG07): proyectos o, como mínimo, servicios y bases de datos con
  nombres distintos (`-dev`, `-test`, `-prod`); las llaves se inyectan por ambiente (RNFG06).

## Justificación

- **Cloud Run** ejecuta el mismo contenedor que ya se usa en local, escala a cero (coste mínimo en
  un proyecto sin tráfico constante) y no exige administrar un clúster.
- **GKE Autopilot** aporta capacidades que este proyecto no necesita (orquestación multi-servicio,
  redes internas, autoescalado complejo) con un coste operativo y económico mayor.
- **Cloud Functions** obligaría a reescribir la API como funciones sueltas y penaliza el arranque en
  frío; el backend es una aplicación NestJS única, no un conjunto de funciones.
- **Cloud SQL** cumple RNFG03 sin cambiar de motor respecto a local (PostgreSQL), y **Cloud Storage**
  cumple RNFG02 y es compatible con la abstracción ya prevista sobre MinIO (ADR-003), lo que
  refuerza la portabilidad (RNF26).
- Secret Manager cubre RNFG06 sin llaves en el repositorio.

## Consecuencias

- **Positivas:** sin servidores que administrar; despliegues reproducibles desde el CI; coste
  controlable; ruta de crecimiento clara.
- **Negativas y cuidados:**
  - Cloud Run tiene **límite de tiempo por petición** (suficiente, pero hay que evitar trabajos
    largos dentro de una petición: se encolarán).
  - Hay que **limitar el número de instancias** para no agotar las conexiones de Cloud SQL (se usará
    un pool/`max_instances` acotado y el conector oficial).
  - Los **egresos de red** y el almacenamiento se facturan: se documentarán los límites de tamaño de
    evidencias (ADR-003).
- **Pendientes:**
  - Verificar disponibilidad de cuentas/permisos de Google Cloud para el proyecto (y si el docente
    provee un proyecto institucional o se usa una cuenta propia).
  - Decidir el proveedor concreto de **IA** (Vertex AI / Gemini / API externa) y su contrato, que
    figura como punto abierto en los requisitos.
  - Definir los **presupuestos y alertas** de facturación desde el primer despliegue.
