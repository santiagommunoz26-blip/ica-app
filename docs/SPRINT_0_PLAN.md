# Sprint 0 Plan - Setup y Arquitectura Base
**Duracion**: 2 semanas (10 dias habiles)  
**Objetivo**: Repo listo, CI verde, arquitectura decidida, spike formularios dinamicos  
**Estado**: S0-1 a S0-6 hechos; ADRs 001–005 escritas; spike del motor de formularios hecho. Queda la protección de la rama `main` (acción manual del usuario).  
**Fecha inicio**: 15 de octubre de 2026

---

## Sprint Goal
"Tener el camino feliz funcionando: `make dev` levanta todo localmente, `git push` corre CI completo, y sabemos como modelar los formularios dinamicos sin hardcodear nada."

---

## Backlog del Sprint (14 Story Points)

| ID | Tarea | SP | Responsable | Done Criteria |
|----|-------|----|-------------|---------------|
| S0-1 | Init repo monorepo (backend + frontend + docs) | 2 | Dev | `git clone` -> `make install` -> `make dev` levanta ambos — **completado (15 oct 2026)**: `make dev` completo verificado y push a GitHub por SSH |
| S0-2 | Configurar ESLint + Prettier + Husky (pre-commit) | 2 | Dev | `make lint` pasa, commit rechazado si falla — **completado (15 oct 2026)**: lint/format OK y hook probado (rechaza commits inválidos) |
| S0-3 | Docker Compose local (PostgreSQL, Redis, MinIO para S3 local) | 3 | Dev | `docker compose up -d` -> BD y storage listos — **completado (15 oct 2026)**: 3 servicios verificados (imagen de MinIO: espejo `pgsty/minio`) |
| S0-4 | Backend: NestJS + TypeORM + PostgreSQL (health check + migration runner) | 3 | Dev | `make migrate` crea tablas, `/health` retorna 200 — **completado (15 oct 2026)**: tablas `app_metadata`+`migrations`, `/health` 200/503 y e2e 2/2 |
| S0-5 | Frontend: Angular 18 + Tailwind + Angular Material (estructura basica) | 2 | Dev | `ng serve` compila, pagina "Hola ICA" visible — **completado (15 oct 2026)**: página «Hola ICA» en la ruta '', bundle 403 kB y 4/4 pruebas (Firefox headless) |
| S0-6 | CI GitHub Actions: lint + typecheck + test + build (backend + frontend) | 2 | Dev | Push a main -> pipeline verde en < 8 min — **hecho (15 oct 2026)**: 3 jobs (backend con PostgreSQL, frontend, formato) en verde en ≈3 min; queda proteger la rama main (acción manual del usuario) |

---

## Spike Tecnico (paralelo, no cuenta en SP)
**Tema**: Motor de formularios dinamicos (US-08)  
**Pregunta**: Como almacenar y versionar checklists anidados (Dimension -> Criterio -> Subcriterio -> Indicador -> Pregunta) con ponderaciones que sumen 100 en cada nivel?  
**Entregable**: Prototipo en `docs/spike-form-engine/` + decision documentada en ADR-001  
**Tiempo maximo**: 4 horas repartidas en 2 dias  
**Resultado (15 oct 2026)**: hecho y **convergido**. Prototipo sin dependencias (`validar.mjs`) con 9 comprobaciones automáticas en verde: validación de pesos que suman 100, fórmulas de la metodología verificadas a mano, «No aplica», perfiles corral/traspatio e **inmutabilidad de la visita cerrada**. Decisión registrada en ADR-001 (modelo híbrido). Ver `docs/spike-form-engine/README.md`

---

## Arquitectura a Decidir (ADRs a escribir)

| ADR | Tema | Opciones a evaluar |
|-----|------|-------------------|
| [ADR-001](adr/ADR-001-modelo-datos-formularios.md) | Modelo de datos formularios dinamicos | JSONB vs tablas relacionales normalizadas vs event sourcing |
| [ADR-002](adr/ADR-002-autenticacion.md) | Autenticacion | Firebase Auth vs JWT propio (NestJS + Passport) |
| [ADR-003](adr/ADR-003-almacenamiento-evidencias.md) | Almacenamiento evidencias | GCS directo (signed URLs) vs backend proxy |
| [ADR-004](adr/ADR-004-comunicacion-api.md) | Comunicacion frontend-backend | REST + OpenAPI vs GraphQL vs tRPC |
| [ADR-005](adr/ADR-005-despliegue-gcp.md) | Despliegue GCP | Cloud Run vs GKE Autopilot vs Cloud Functions |

**Estado (15 oct 2026)**: las cinco ADRs están **escritas y aceptadas** (índice en `docs/adr/README.md`), con las alternativas descartadas, los requisitos relacionados y los puntos pendientes de confirmar con el docente.

---

## Definition of Done del Sprint 0
- [x] `make dev` levanta backend (puerto 3000) + frontend (puerto 4200) + BD + MinIO — **verificado (S0-1)**
- [x] `make test` corre unit + integration — **verificado**: backend 1/1, e2e 2/2, frontend 4/4. La *cobertura > 60 % en dominio* queda pendiente de medir cuando exista dominio (M1+)
- [x] `make lint` pasa sin warnings en ambos proyectos — **verificado (S0-2)**, y el hook de pre-commit rechaza commits con errores
- [x] Pipeline CI verde en GitHub Actions — **hecho (S0-6)**: 3 jobs en verde en ≈3 min
- [ ] **Rama `main` protegida** — pendiente: acción manual del usuario en GitHub (Settings → Branches)
- [x] ADRs escritas y aprobadas (las cinco, no solo la 001) — ver `docs/adr/`
- [ ] `LEARNING_LOG.md` actualizado con decisiones y dudas — archivo **inexistente** (citado por el plan; por definir con el docente)
- [x] README.md con instrucciones claras para nuevo dev — **hecho (S0-1…S0-6)**

---

## Riesgos y Mitigacion

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| NestJS/Angular learning curve | Media | Alto | Timebox 2h/dia tutorial oficial; pair programming simulado (PR a ti mismo) |
| Docker en local (permisos, puertos) | Alta | Bajo | Documentar `make dev` paso a paso; usar puertos fijos |
| Spike formularios no converge | Media | Alto | Limitar a 4h; si no, decidir "tablas normalizadas v1" e iterar despues |
| Scope creep (empezar US reales) | Muy alta | Medio | **Regla**: Sprint 0 SOLO setup. Ninguna user story de negocio. |

---

## Daily Standup (personal, 5 min)
**Formato** (escribe en `LEARNING_LOG.md` cada dia):
```
## Dia X - [Fecha]
### Ayer: [que termine]
### Hoy: [que ataco]
### Bloqueos: [que necesito ayuda/investigar]
### Decision clave: [si hubo alguna]
```

---

## Sprint Review (fin de sprint)
**Demo a ti mismo (y al profesor si quiere)**:
1. `git clone` repo limpio -> `make install` -> `make dev` -> todo arriba
2. `git push` -> GitHub Actions pasa
3. Mostrar ADR-001 con decision de modelo formularios
4. Preguntas: ¿Que fue facil? ¿Que dolio? ¿Que automatizo la proxima?

---

## Sprint Retrospective (15 min)
**Formato Start/Stop/Continue** (escribe en `LEARNING_LOG.md`):
- **Start**: [una cosa que hare en Sprint 1]
- **Stop**: [una cosa que no funciono]
- **Continue**: [una cosa que funciono bien]

**Accion concreta para Sprint 1**: ___________________________________

---

## Capacidad Real
- Dias habiles: 10
- Horas/dia estimadas: [TU ESTIMACION]
- Buffer (imprevistos, aprendizaje): 20%
- **SP realistas**: 14 (no te comprometas a mas)

---

## Notas para Sprint 1 (ya las tienes en BACKLOG_INICIAL.md)
**Must Have candidatos** (elige ~20 SP):
- US-01 Login (3)
- US-02 Refresh token (2)
- US-03 Recuperar pass (3)
- US-04 RBAC (5)
- US-05 CRUD Fincas (5)
- US-07 Especies (3)
- **Total**: 21 SP -> ajusta segun velocidad real Sprint 0

---

**Firma / Compromiso**: _________________  Fecha: __________
