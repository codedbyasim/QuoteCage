.PHONY: test typecheck up down logs e2e

test:
	npm test

typecheck:
	npm run typecheck

up:
	test -f .env || cp .env.example .env
	mkdir -p /var/quotecage/work /var/quotecage/allow
	docker compose up -d --build

down:
	docker compose down --remove-orphans

logs:
	docker compose logs -f --tail=200

e2e: up
	node scripts/e2e.mjs
