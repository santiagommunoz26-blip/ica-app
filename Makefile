SHELL := /bin/bash
.DEFAULT_GOAL := help

# Navegador para Karma. En CI se usa ChromeHeadless (viene en el runner); en
# local, si no hay Chrome: make test-frontend KARMA_BROWSER=FirefoxHeadless
KARMA_BROWSER ?= ChromeHeadless

.PHONY: help install infra dev dev-backend dev-frontend down logs \
        test test-backend test-backend-e2e test-frontend lint lint-backend lint-frontend \
        format format-check build build-backend build-frontend \
        migrate migrate-revert

help: ## Muestra la lista de comandos disponibles
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Instala las dependencias de la raíz, el backend y el frontend
	npm install
	cd backend && npm install
	cd frontend && npm install

infra: ## Levanta PostgreSQL, Redis y MinIO con Docker Compose
	docker compose up -d

dev: infra ## Levanta la infraestructura y los servidores de desarrollo (backend :3000, frontend :4200)
	@echo "Infraestructura lista. Backend: http://localhost:3000  |  Frontend: http://localhost:4200"
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Solo el backend en modo desarrollo (:3000)
	cd backend && npm run start:dev

dev-frontend: ## Solo el frontend en modo desarrollo (:4200)
	cd frontend && npm start

down: ## Apaga la infraestructura
	docker compose down

logs: ## Sigue los logs de la infraestructura
	docker compose logs -f

test: test-backend test-frontend ## Corre las pruebas de backend y frontend

test-backend: ## Pruebas del backend
	cd backend && npm test

test-backend-e2e: ## Pruebas de integración del backend (requieren la infraestructura arriba)
	cd backend && npm run test:e2e

test-frontend: ## Pruebas del frontend (ChromeHeadless por defecto; en local: make test-frontend KARMA_BROWSER=FirefoxHeadless)
	cd frontend && npm test -- --watch=false --browsers=$(KARMA_BROWSER)

lint: lint-backend lint-frontend ## Corre el linter en backend y frontend

lint-backend: ## Linter del backend
	cd backend && npm run lint

lint-frontend: ## Linter del frontend
	cd frontend && npm run lint

format: ## Formatea el código con Prettier (backend, frontend y raíz)
	npm run format

format-check: ## Verifica el formato sin modificar archivos
	npm run format:check

build: build-backend build-frontend ## Compila backend y frontend

build-backend: ## Build del backend
	cd backend && npm run build

build-frontend: ## Build del frontend
	cd frontend && npm run build

migrate: ## Aplica las migraciones de base de datos (requiere la infraestructura arriba)
	cd backend && npm run migration:run

migrate-revert: ## Revierte la última migración aplicada (requiere la infraestructura arriba)
	cd backend && npm run migration:revert
