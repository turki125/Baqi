# Baqi

Baqi is a bilingual marketplace for surplus construction materials in Riyadh. People can browse public listings without an account; signing in is required to sell, message, reserve, and manage orders.

## MVP features

- English and Arabic interface with right-to-left layout
- Search, category and condition filters, and price sorting
- Listing creation with photo uploads, optional phone visibility, and partial or full-lot sales
- Buyer-seller conversations, order tracking, 10% reservation deposits, and seller wallet
- Card, Mada, and withdrawal flows are simulations only; no real funds move
- Gemini-powered photo search and optional listing suggestions, with seller review before applying any suggested fields

## Photo assistance

Gemini uses Replit AI Integrations, with no user-supplied API key. Model usage is billed to the workspace's Replit credits. Provision the Gemini integration before running these features; managed credentials stay in Secrets and are never included in this repository.

- Sign in to upload a private reference photo or request listing suggestions. Public browsing and text search still work without an account.
- On the first selling step, upload a cover photo and choose **Suggest details**. Review and select the proposed title, category and description, then explicitly apply them. Replacing existing title/description text requires confirmation. Quantity, price and sale rules are never generated or changed.
- On Browse, choose **Search with a photo**. Search optionally combines the image with text/category/condition/free-only filters and a minimum quantity in an exact unit (including custom units). No unit conversion or pooling quantities across listings is performed.
- Visual search compares up to 12 recent qualifying listings with usable photos. Similarity is an estimate, not proof of exact dimensions, model, grade, authenticity or safety. Verify confirmed listing details with the seller.
- JPEG, PNG and WebP uploads are limited to 10 MB and resized before analysis. Reference photos remain private; a listing photo becomes public when its owner publishes the listing.
- AI is invoked only on explicit request. Per-server safeguards allow five photo requests per minute per account and two simultaneous analyses. Failures keep manual entry and normal text search available.

## Workspace

This project uses pnpm workspaces. The Baqi web app is in `artifacts/baqi`; its API is in `artifacts/api-server`, with shared API and database packages under `lib/`.

Use the configured Replit workflows to run the app and API. After changing database schemas, apply the development schema with:

```sh
pnpm --filter @workspace/db run push
```
