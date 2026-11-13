# Baqi · باقي

A bilingual marketplace for buying, selling, and giving away surplus construction materials in Riyadh.

## Run & Operate

- Use the managed `artifacts/baqi: web` workflow for the marketplace at `/` (port 18354), and `artifacts/api-server: API Server` for `/api` (port 8080). These workflows supply `PORT` and `BASE_PATH`; run both for the full app.
- Install dependencies with `pnpm install --frozen-lockfile` using Node.js 24.
- `pnpm --filter @workspace/api-server run dev` — build and run the API server; requires `PORT` from its managed workflow.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Development setup: the PostgreSQL schema has been applied, Replit-managed Clerk has been provisioned, and App Storage has been provisioned. Keep credentials in Secrets; do not copy them into files.
- Clerk requires `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY`. App Storage uses `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, and `PRIVATE_OBJECT_DIR`.
- Gemini photo assistance is optional and currently unconfigured. Manual listing entry and text search remain available. Enable Replit's Gemini integration before using photo assistance.
- Health check through the shared proxy: `curl -fsS http://localhost:80/api/healthz`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/baqi/` — React marketplace and bilingual UI.
- `artifacts/api-server/` — Express API, Clerk proxy, listing and storage routes.
- `lib/db/src/schema/` — Drizzle database schema.
- `lib/api-spec/openapi.yaml` — API contract; regenerate clients after changing it.
- `artifacts/mockup-sandbox/` — separate component preview sandbox, not required for the marketplace.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

Public browsing and text search do not require an account. Selling, messaging, reservations, and orders require sign-in. Payments, deposits, wallet balances, and withdrawals are simulations; no real funds move.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
