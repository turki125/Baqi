# Baqi

Baqi is a bilingual marketplace for surplus construction materials in Riyadh. People can browse public listings without an account; signing in is required to sell, message, reserve, and manage orders.

## MVP features

- English and Arabic interface with right-to-left layout
- Search, category and condition filters, and price sorting
- Listing creation with photo uploads, optional phone visibility, and partial or full-lot sales
- Buyer-seller conversations, order tracking, 10% reservation deposits, and seller wallet
- Card, Mada, and withdrawal flows are simulations only; no real funds move
- Photo search and AI listing suggestions are paused until Baqi AI is connected

## Workspace

This project uses pnpm workspaces. The Baqi web app is in `artifacts/baqi`; its API is in `artifacts/api-server`, with shared API and database packages under `lib/`.

Use the configured Replit workflows to run the app and API. After changing database schemas, apply the development schema with:

```sh
pnpm --filter @workspace/db run push
```
