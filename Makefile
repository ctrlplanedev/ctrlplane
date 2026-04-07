UNAME := $(shell uname -s)

.DEFAULT_GOAL := help

# -------------------------------------------------------------------------
# Help
# -------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' \
		| sort

# -------------------------------------------------------------------------
# Setup
# -------------------------------------------------------------------------

reset ?= False

.PHONY: start
start: ## Full setup and start dev servers (use reset=True to wipe all local data first)
ifeq ($(reset),True)
	docker compose -f docker-compose.dev.yaml down -v
endif
	$(MAKE) docker-up
ifdef FLOX_ENV
	pnpm install && pnpm build
	$(MAKE) db-migrate
	pnpm dev
else
	flox activate -c 'pnpm install && pnpm build && pnpm -F db migrate && pnpm dev'
endif

.PHONY: install-tools
install-tools: ## Install required system tools (Flox, Docker)
ifeq ($(UNAME), Darwin)
	@$(MAKE) _install-tools-mac
else
	@$(MAKE) _install-tools-linux
endif

.PHONY: _install-tools-mac
_install-tools-mac:
	@echo "==> Checking system tools (macOS)..."
	@command -v brew >/dev/null 2>&1 || { \
		echo ""; \
		echo "Homebrew is not installed. Install it first:"; \
		echo "  https://brew.sh"; \
		echo ""; \
		exit 1; \
	}
	@command -v docker >/dev/null 2>&1 \
		&& echo "  docker        already installed" \
		|| (echo "  docker        installing..." && brew install --cask docker)
	@command -v flox >/dev/null 2>&1 \
		&& echo "  flox          already installed" \
		|| (echo "  flox          installing..." && brew install flox/flox/flox)
	@echo "==> Done. Run 'flox activate' to load the dev environment."

.PHONY: _install-tools-linux
_install-tools-linux:
	@echo "==> Linux detected. Please install the following tools manually:"
	@echo ""
	@echo "  Docker:  https://docs.docker.com/engine/install/"
	@echo "  Flox:    https://flox.dev/docs/install-flox/"
	@echo ""
	@echo "Then run 'flox activate' to load the dev environment."

# -------------------------------------------------------------------------
# Code quality
# -------------------------------------------------------------------------

.PHONY: test
test: ## Run all tests (TypeScript + Go)
	pnpm test
	cd apps/workspace-engine && go test ./...
	cd apps/relay && go test ./...

.PHONY: lint
lint: ## Lint all code (TypeScript + Go)
	pnpm lint
	cd apps/workspace-engine && golangci-lint run
	cd apps/relay && golangci-lint run

.PHONY: format
format: ## Format all code (TypeScript + Go)
	pnpm format:fix
	cd apps/workspace-engine && go fmt ./...
	cd apps/relay && go fmt ./...

# -------------------------------------------------------------------------
# Docker
# -------------------------------------------------------------------------

.PHONY: docker-up
docker-up: ## Start local services (Postgres, Kafka, etc.)
	docker compose -f docker-compose.dev.yaml up -d

.PHONY: docker-down
docker-down: ## Stop local services
	docker compose -f docker-compose.dev.yaml down

.PHONY: docker-logs
docker-logs: ## Tail logs from local services
	docker compose -f docker-compose.dev.yaml logs -f

# -------------------------------------------------------------------------
# Database
# -------------------------------------------------------------------------

.PHONY: db-migrate
db-migrate: ## Run database migrations
	pnpm -F db migrate

.PHONY: db-push
db-push: ## Push schema changes (dev only)
	pnpm -F db push

.PHONY: db-studio
db-studio: ## Open Drizzle Studio
	pnpm -F db studio
