# Recipe Register
#
# Deployment lives in deploy/Makefile, which git ignores because it carries
# the host address and paths. Run `make deploy` to reach it.

.PHONY: help install dev build start test typecheck e2e check clean deploy

help: ## Show this help
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

install: ## Install the dependencies
	npm install

dev: ## Run the app for development on http://localhost:3000
	npm run dev

build: ## Build the app for production
	npm run build

start: build ## Build, then serve the production build
	npm start

test: ## Run the unit tests
	npx vitest run

typecheck: ## Check the types
	npx tsc --noEmit

e2e: ## Run the end-to-end tests
	npm run e2e

check: test typecheck build e2e ## Run every gate: tests, types, build, end to end
	@echo "all checks passed"

clean: ## Remove the build output and the test artefacts
	rm -rf .next test-results playwright-report e2e/.recipes

deploy: ## Deploy to the server. Needs deploy/Makefile.
	@test -f deploy/Makefile || { echo "deploy/Makefile is missing. It is not in git."; exit 1; }
	@$(MAKE) -C deploy deploy
