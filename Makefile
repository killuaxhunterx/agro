# Gestão de Campo e Feedback Comercial (projeto agro).
# Fonte única dos comandos de dev. `make help` lista todos.
# A configuração vem do .env (copie de .env.example).

SHELL := /bin/bash
ENV := set -a; [ -f .env ] && . ./.env; set +a;
DEV_API_PORT ?= 8981
DEV_WEB_PORT ?= 5974

.PHONY: help db-up up dev web build test lint audit migrate-up migrate-status demo demo-reset sqlc-generate serve

help: ## lista os comandos
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-16s %s\n",$$1,$$2}'

db-up: ## sobe o Postgres de dev (container agro-postgres, porta 5435)
	@docker start agro-postgres >/dev/null 2>&1 || docker run -d --name agro-postgres \
	  -e POSTGRES_USER=agro -e POSTGRES_PASSWORD=agro_dev -e POSTGRES_DB=agro \
	  -p 5435:5432 --restart unless-stopped postgres:18 >/dev/null
	@echo "postgres em localhost:5435"

up: ## API + frontend juntos (Ctrl+C derruba os dois)
	@trap 'kill 0' EXIT; \
	$(ENV) PORT=$(DEV_API_PORT) COOKIE_SECURE=false LOG_FORMAT=text go run ./cmd/agro & \
	DEV_API_PORT=$(DEV_API_PORT) DEV_WEB_PORT=$(DEV_WEB_PORT) pnpm --dir frontend dev & \
	wait

dev: ## só a API
	$(ENV) PORT=$(DEV_API_PORT) COOKIE_SECURE=false LOG_FORMAT=text go run ./cmd/agro

web: ## só o frontend (Vite, repassa /api para a API)
	DEV_API_PORT=$(DEV_API_PORT) DEV_WEB_PORT=$(DEV_WEB_PORT) pnpm --dir frontend dev

build: ## compila bin/agro e frontend/dist
	go build -o bin/agro ./cmd/agro
	pnpm --dir frontend build

serve: build ## um processo só: API + frontend compilado (demonstração)
	$(ENV) STATIC_DIR=frontend/dist ./bin/agro

migrate-up: ## aplica as migrações pendentes
	$(ENV) go run ./cmd/agro migrate up

migrate-status: ## estado das migrações
	$(ENV) go run ./cmd/agro migrate status

demo: ## cria a empresa de demonstração (dados fictícios)
	$(ENV) go run ./cmd/agro demo

demo-reset: ## APAGA o banco de dev inteiro e recria o demo
	docker exec agro-postgres psql -U agro -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
	$(MAKE) migrate-up demo

sqlc-generate: ## gera internal/store/sqlc a partir das queries
	sqlc generate

test: ## testes Go
	go test -race -count=1 ./...

lint: ## vet + gofmt + typecheck + oxlint
	go vet ./...
	@test -z "$$(gofmt -l cmd internal migrations)" || (gofmt -l cmd internal migrations; exit 1)
	pnpm --dir frontend typecheck
	pnpm --dir frontend lint

audit: lint test ## portão completo
	sqlc diff
