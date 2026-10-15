# EBA Aves — Aplicativo de bienestar animal en aves

Aplicación web para evaluar el bienestar animal en aves de corral y de traspatio siguiendo la **metodología del ICA (v2.0, 2024)**: registro de granjas y lotes, captura de evidencias, evaluación por indicadores y generación de reportes.

> Proyecto académico. La metodología es autoría del ICA y se usa con fines no comerciales.

## Estado

**Sprint 0 (setup)** en progreso. Ver:

- `docs/CONTEXTO_PROYECTO.txt` — estado y continuidad del proyecto
- `docs/PROMPT_MAESTRO.txt` — guía de construcción por módulos
- `docs/SPRINT_0_PLAN.md` — plan del Sprint 0

## Stack

- **Frontend:** Angular
- **Backend:** Node.js + NestJS (API REST)
- **Base de datos:** PostgreSQL (Docker en local → Cloud SQL en producción)
- **Almacenamiento de evidencias:** MinIO en local → Cloud Storage en producción
- **Infraestructura:** Docker Compose; CI con GitHub Actions (`make install/dev/test/lint`)
- **Nube objetivo:** Google Cloud

## Estructura

```
ica-app/
├── backend/              # API NestJS
├── frontend/             # Aplicación Angular
├── docs/                 # Requerimientos, wireframes, plan y contexto
├── docker-compose.yml    # PostgreSQL + Redis + MinIO para desarrollo
├── .env.example          # Variables de entorno de ejemplo
└── Makefile              # Automatización (install/dev/test/lint/build)
```

## Requisitos

- Node.js 22 LTS y npm
- Docker y Docker Compose

## Cómo empezar

```bash
git clone https://github.com/santiagommunoz26-blip/ica-app.git
cd ica-app

make install   # instala dependencias de backend y frontend
make dev       # levanta infraestructura + backend (:3000) + frontend (:4200)
```

Otros comandos útiles:

| Comando | Descripción |
| --- | --- |
| `make help` | Lista todos los comandos disponibles |
| `make infra` | Solo levanta PostgreSQL, Redis y MinIO |
| `make down` | Apaga la infraestructura |
| `make logs` | Sigue los logs de la infraestructura |
| `make test` | Pruebas de backend y frontend |
| `make lint` | Linter de backend y frontend |
| `make build` | Compila backend y frontend |

## Documentación

- `docs/CONTEXTO_PROYECTO.txt` — estado, decisiones y continuidad entre sesiones
- `docs/PROMPT_MAESTRO.txt` — guía de construcción por módulos
- `docs/SPRINT_0_PLAN.md` — plan del Sprint 0
- `docs/Requerimientos funcionales y no funcionales – Aplicativo EBA Aves.docx`
- `docs/Objetivos, reglas y roles por módulo – Aplicativo EBA Aves.pdf`
- `docs/Aplicativo EBA Aves – Wireframes.pdf`
