# Stack tecnológico — Aplicativo EBA Aves

Documento de referencia del **stack real del proyecto**: qué se usa hoy, para qué
sirve cada pieza, por qué encaja con los requisitos y qué se añadirá en el futuro.

- **Fecha:** 15 de octubre de 2026
- **Estado:** documento vivo (se actualiza cuando cambie el stack; los cambios de
  arquitectura se registran como ADR en `docs/adr/`).
- **Alcance:** software e infraestructura del aplicativo (no cubre la metodología ICA).

> Nota: este documento se redactó a partir de los archivos reales del proyecto
> (`package.json`, `docker-compose.yml`, `backend/src/database/`, ADRs). Si algún dato
> no coincide, **prevalecen los archivos reales**.

---

## 1. Resumen

| Capa | Tecnología | Versión | Dónde vive |
| --- | --- | --- | --- |
| **Lenguaje** | TypeScript (todo el proyecto) | 6.0 (backend) / 5.5 (frontend) | `backend/src/`, `frontend/src/` |
| **Backend** | Node.js + NestJS (API REST) | Node 22 LTS + NestJS 12 | `backend/` |
| **Frontend** | Angular + Material + Tailwind CSS | Angular 18.2 + Material 18.2 + Tailwind 3.4 | `frontend/` |
| **Gráficas** | Chart.js | 4.5 | `frontend/` |
| **Base de datos** | PostgreSQL | 16 (Docker local → Cloud SQL en producción) | `docker-compose.yml`, `backend/src/database/` |
| **Acceso a datos** | TypeORM con migraciones (`synchronize: false`) | 1.1 | `backend/src/database/` |
| **Autenticación** | JWT propio + contraseñas argon2id | — | `backend/src/auth/` |
| **Caché / colas** | Redis | 7 (local; aún sin uso en el código) | `docker-compose.yml` |
| **Evidencias** | MinIO (API S3) local → Cloud Storage en producción | — | `docker-compose.yml`, ADR-003 |
| **Pruebas backend** | Vitest + supertest | 4.1 | `backend/` |
| **Pruebas frontend** | Karma + Jasmine | — | `frontend/` |
| **Calidad** | Prettier, Husky + lint-staged, oxlint (backend), ESLint (frontend) | — | raíz del repo |
| **CI / automatización** | GitHub Actions + Makefile | — | `.github/`, `Makefile` |
| **Nube objetivo** | Google Cloud (Cloud Run, Cloud SQL, Cloud Storage, Secret Manager…) | — | ADR-005 |

## 2. Lenguaje: TypeScript en todo el proyecto

- **Backend y frontend comparten un solo lenguaje**, TypeScript. Reduce el cambio de
  contexto, permite compartir tipos y conceptos (DTO, validaciones) y facilita que
  otra persona retome el código.
- El backend es **ESM** (`"type": "module"` en `backend/package.json`).
- La interfaz se escribe en **HTML + SCSS** (plantillas y estilos de Angular).
- **SQL**: no hay scripts `.sql` sueltos; todo cambio de esquema pasa por las
  **migraciones de TypeORM** (`backend/src/database/migrations/`).
- **YAML** (Docker Compose, GitHub Actions) y **Makefile** son soporte del proyecto,
  no código de la aplicación.

## 3. Frontend — Angular 18

- **Angular 18.2** con **Angular Material 18** (incluye CDK) y **Tailwind CSS 3**.
  La combinación está documentada en `docs/DISENO.md`: el tema propio de Material vive
  en `frontend/src/theme/` y Tailwind consume los tokens como variables CSS.
- **Chart.js 4.5** para las gráficas del panel (RF38–RF42).
- **RxJS 7.8** para el manejo de flujo asíncrono y `zone.js` como base de detección de
  cambios de Angular.
- Pruebas con **Karma + Jasmine**; lint con **angular-eslint**.
- **Modo sin conexión (previsto para M2):** PWA + almacenamiento local (IndexedDB) y
  cola de sincronización; el PIN de acceso sin conexión (RF03) ya existe.

## 4. Backend — Node.js 22 + NestJS 12

- **API REST** versionada en `/api/v1/...`; `/health` queda fuera del prefijo para los
  monitoreos (ADR-004).
- **Swagger / OpenAPI 3** generado automáticamente en `/api/docs`.
- **Autenticación propia con JWT** (ADR-002): access token en memoria (900 s) y refresh
  token rotado; contraseñas con **argon2id** (`@node-rs/argon2`); roles y permisos fijos
  en código (`backend/src/common/roles.ts`) y guardas: JWT → cambio obligatorio de
  contraseña → roles.
- **Validación de entrada** con `class-validator` y `class-transformer` (DTO por
  endpoint): es la misma pieza que garantiza las reglas duras de la API.
- **Acceso a datos con TypeORM** (ver sección 5) y **health checks** con
  `@nestjs/terminus`.
- **Pruebas** con **Vitest** (+ supertest para e2e) y lint con **oxlint**.

## 5. Base de datos — PostgreSQL 16

- **Motor:** PostgreSQL 16.
  - **Local:** contenedor `ica-postgres` (`postgres:16-alpine`) definido en
    `docker-compose.yml`.
  - **Producción (planeada):** **Cloud SQL for PostgreSQL** — el mismo motor, por lo
    que no hay migración de datos, solo de conexión (ADR-005).
- **Acceso:** TypeORM con `synchronize: false`; **las tablas se crean siempre con
  migraciones** (`npm run migration:run` / `make migrate`), nunca a mano.
- **Tablas existentes hoy** (por las migraciones): `app_metadata`, `usuarios`,
  `sesiones`, `tokens_password`, `registro_acceso`, `predios` y `visitas`
  (módulo M1 completo y base del M2).
- **Modelo previsto (ADR-001, híbrido):**
  - **Catálogo normalizado y versionado**: `metodologia_version`, `grupo_medida`,
    `indicador`, `escala_indicador`, `peso_grupo`, `tipo_pregunta`… con integridad
    referencial y validación de pesos que suman 100 %.
  - **Respuestas de visita en JSONB** con *snapshot* de la versión del catálogo usada,
    para que las visitas cerradas sean inmutables (RF49, RNF18).
- **Evidencias:** los binarios **no** van a la base de datos; solo sus metadatos
  (tabla `evidencia`), y el archivo se sube al almacenamiento con URLs firmadas
  (ADR-003).

## 6. Servicios de apoyo (local → nube)

| Servicio | Local (Docker Compose) | Producción (prevista) | Uso |
| --- | --- | --- | --- |
| Base de datos | `postgres:16-alpine` | Cloud SQL for PostgreSQL | Datos estructurados |
| Caché / colas | `redis:7-alpine` | Redis administrado (o Memorystore) | Previsto: caché, rate limiting, colas de trabajos (PDF, correos). **Hoy el código aún no lo usa.** |
| Evidencias | MinIO (`pgsty/minio`, API S3) | Cloud Storage | Fotos, documentos y videos cortos con URLs firmadas (ADR-003) |

- **Docker Compose** levanta toda la infraestructura local (`make infra`).
- **Makefile** automatiza: `install`, `dev`, `infra`, `migrate`, `test`, `lint`,
  `format`, `build`, `logs`, `down`.

## 7. Calidad y automatización

- **Prettier** (formato único) + **Husky/lint-staged** (hook pre-commit).
- **oxlint** en backend y **ESLint** en frontend, ambos en modo estricto.
- **CI con GitHub Actions** en cada push: instala, lints, compila y corre pruebas
  (`make install/test/lint/build`).
- **Vitest** (backend, unitario y e2e) y **Karma/Jasmine** (frontend).

## 8. ¿Por qué este stack encaja con el proyecto?

- **El docente lo fijó**: Angular (frontend), Node.js/NestJS (backend) y Google Cloud
  (despliegue, BD administrada, almacenamiento, IA y monitoreo). El stack no se cambia
  sin consultar.
- **TypeScript único** en back y front: un solo lenguaje para todo el equipo.
- **Angular** encaja con una aplicación de **formularios guiados y complejos** (4 fases
  de visita, validaciones por metodología, roles): router, formularios reactivos, DI,
  Material y validación vienen incluidos.
- **NestJS** encaja con la **organización por módulos (M1–M8)**: módulos, guards por
  rol, DTOs con `class-validator` y Swagger.
- **PostgreSQL** es la elección natural para datos **relacionales y transaccionales**
  (predios → visitas → indicadores → pesos → versiones) con integridad fuerte; y
  **Cloud SQL es el mismo motor**, así que local y producción no divergen.
- **La ruta a Google Cloud está trazada** en ADR-005: Cloud Run (backend), Firebase
  Hosting (frontend), Cloud SQL, Cloud Storage, Secret Manager, Cloud Logging/Monitoring.

## 9. Dónde está el riesgo real (que no es el stack)

1. **Modo sin conexión y sincronización** (RF12, RNF02): es el reto principal del
   proyecto. Angular PWA + IndexedDB lo permiten, pero hay que diseñar bien la cola de
   sincronización y la resolución de conflictos (se detalla en M2; ver ADR-004).
2. **Fidelidad exacta de la metodología ICA** (fórmulas, pesos, escalas, plazos)
   (RNF03, RNF27): se resuelve con el catálogo versionado (ADR-001) y pruebas
   unitarias del cálculo. Falta el documento fuente de la metodología (punto abierto).
3. **Acta en PDF firmable y envío por correo**: sencillo en tecnología, laborioso en
   ejecución.
4. **La IA (RF24–RF26, RNFG04)**: sigue sin confirmarse si va; si va, se consumirá
   como servicio externo (Vertex AI / Gemini u otro) desde el backend.

## 10. Evolución prevista (qué se añadirá)

| Momento | Se añade | Relacionado con |
| --- | --- | --- |
| M2 | Almacenamiento offline (IndexedDB), cola de sincronización y cola de subida de evidencias | RF12, RNF02, ADR-003 |
| M2–M3 | Uso real de Redis (caché / colas) cuando haga falta | RNF04, RNF05 |
| M5–M6 | Generación del **acta en PDF** (Puppeteer o pdfkit, por decidir) y **exportaciones Excel/CSV** | RF43–RF45, RF52 |
| M8 | Despliegue completo en **Google Cloud**: Cloud Run, Cloud SQL, Cloud Storage, Secret Manager, Cloud Logging/Monitoring, ambientes `-dev`/`-test`/`-prod` | RNFG01–RNFG07, ADR-005 |
| M8 | **Correo real por SMTP** (hoy el transporte es «consola») | RF06, RF45 |
| Por confirmar | **IA como servicio externo** para recomendaciones | RF24–RF26, RNFG04 |
| Por confirmar | Cifrado en reposo de tokens en el equipo (RNF09) | RNF09 |

## 11. Puntos abiertos relacionados con el stack

- Confirmar con el docente el **alcance de la IA** antes de decidir proveedor y
  arquitectura (punto abierto n.º 1 de `docs/CONTEXTO_PROYECTO.txt`).
- Obtener el **documento de la metodología ICA** (v2.0, 2024) para validar el catálogo
  y los cálculos (punto abierto n.º 5).
- Verificar cuentas/permisos de Google Cloud y definir presupuestos/alarmas de
  facturación antes del primer despliegue (ADR-005).
- Decidir la librería de PDF y la política de tamaño máximo de videos cortos
  (ADR-003).

## 12. Referencias

- `README.md` — visión general y comandos.
- `docs/CONTEXTO_PROYECTO.txt` — estado, decisiones y continuidad entre sesiones.
- `docs/PROMPT_MAESTRO.txt` — guía de construcción por módulos.
- `docs/DISENO.md` — base de diseño de la interfaz (tema, tokens, componentes).
- `docs/adr/` — ADR-001 (modelo de datos), ADR-002 (autenticación), ADR-003
  (evidencias), ADR-004 (API REST), ADR-005 (despliegue en GCP).
- `docker-compose.yml`, `Makefile`, `backend/package.json`, `frontend/package.json` —
  fuentes reales del stack.
