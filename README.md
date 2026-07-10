# DakNet — Bharatiya Dak, now online

## Layout

```
apps/
  postman/        Field operator PWA (React 19 + Vite + Tailwind v4 + Leaflet)
  postman-api/     Express 5 API (Node/pg, deployed on Render)
packages/
  database/        Drizzle schema + DB client — @workspace/db
  api-spec/        openapi.yaml, source of truth for the API contract
  api-zod/         Generated from api-spec
  api-client/      Generated React Query client — @workspace/api-client-react
```

`postman` is the working Field-Operations app, ported over — not a rewrite. `postman-api` is the same Express backend, same routes, same auth. Nothing here was rebuilt from scratch; only renamed and reorganized. `POSTBOOK` (the address-intelligence app) doesn't exist yet — it's the next app to add once the address-governance work is built out.

## What changed in the port

- `artifacts/*` → `apps/*`, `lib/*` → `packages/*`. Package **names** (`@workspace/db` etc.) are unchanged, so pnpm dependency resolution needed no edits — only the three `tsconfig.json` project `references` that pointed at the old paths, plus the workspace glob in `pnpm-workspace.yaml`.
- Two stray near-empty files (`middlewares/One`, a mockup junk file) were dropped.
- `packages/database` now includes the DigiPIN, DigiLocker, and photo-evidence schema additions, plus per-visit delivery-signature fields (see below) — all verified before landing here, not just copied over.

## Required workflow after any schema change

This bit only lived in local agent notes before, so it's written down properly now:

1. Edit `packages/database/src/schema/*.ts`
2. `pnpm --filter @workspace/db run push` — pushes to Postgres directly (no migration files; this is a `drizzle-kit push` workflow)
3. `pnpm run typecheck:libs` — rebuilds the `.d.ts` output every other package imports against
4. If `packages/api-spec/openapi.yaml` also changed: `pnpm --filter @workspace/api-spec run codegen` (this runs step 3 internally too)

Skipping step 3 is the most common cause of "module has no exported member X" errors in `postman-api` after a schema change — it's not a stale cache, the consuming package is type-checking against an out-of-date build.

## Verification model

Three independent signals ground a record instead of an arbitrary generated ID:

- **DigiPIN** (`packages/database/src/geo/digipin.ts`) — real India Post algorithm, not a placeholder. Verified against the published Dak Bhawan test case (`39J49LL8T4`).
- **Photo** — `visitPhotosTable` for per-visit evidence; a reference photo on the address itself is planned but not yet added.
- **A govt-backed identity check** — DigiLocker today (`digilockerVerified*` fields on `addressesTable`, for the resident/occupant). For delivery visits specifically, `visitsTable` now carries its own `verificationMethod` + `verifiedRecipientName/Mobile` + `verificationTxnId` + `verifiedAt` — a digital signature equivalent, deliberately not hard-coded to DigiLocker only (`verificationMethod` is a plain string) so a second free govt service — Aadhaar-based eSign is the realistic next candidate, since it's OTP-based and doesn't require the recipient to already have a DigiLocker account — can be added without a schema change. A visit with no method recorded simply wasn't digitally signed; photo evidence can still exist independently for recipients without access to either.

Both DigiLocker and any future method here stay **simulated** until a real integration is registered with the issuing service — that's a licensing/onboarding step, not a code change, and is called out as simulated everywhere it appears rather than implied to be live.

## PostGIS

`beats.geom` and `offices.geom` are new, additive geometry(polygon, 4326) columns — `polygonGeoJson` isn't removed or replaced. Two one-time steps that aren't part of `drizzle-kit push` and have to be run manually, both from the Neon SQL Editor (or any Postgres client):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Then, after `pnpm --filter @workspace/db run push` has created the new columns, backfill them from the existing polygons:

```sql
UPDATE beats SET geom = ST_SetSRID(ST_GeomFromGeoJSON(polygon_geo_json::text), 4326) WHERE polygon_geo_json IS NOT NULL;
UPDATE offices SET geom = ST_SetSRID(ST_GeomFromGeoJSON(polygon_geo_json::text), 4326) WHERE polygon_geo_json IS NOT NULL;
```

`packages/database/src/geo/spatial.ts` has `findBeatContainingPoint(lat, lng)` — a real `ST_Contains` query against the indexed column, not the JS-side filtering used elsewhere in the app so far.

## Deployment

Two Render services against `apps/postman-api` and `apps/postman`, same as the current live deploy. New env vars needed on `postman-api` for photo upload: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (Cloudflare R2 — create the bucket + API token first, the server throws on boot without them, on purpose, matching how `DATABASE_URL` is already handled).

## Addresses at national scale

`GET /addresses` is no longer "load every row, filter in JS" — that breaks the moment this holds more than a few thousand rows. It's now server-side `ILIKE` search, `ORDER BY name`, and keyset pagination (cursor on `name, id` — stays fast on page 500, unlike `OFFSET`, which gets slower every page deeper). Response shape changed: `{ items: Address[], nextCursor: string | null }`, not a flat array — anything consuming this endpoint needs to unwrap `items` now.

`digilockerIdHash` is a one-way hash for "does this person already have another address on file," deliberately not a raw ID number — storing Aadhaar numbers directly needs UIDAI AUA/KUA authorization; a real DigiLocker integration should provide its own stable reference to hash instead of the number itself. `GET /addresses/:id/possible-duplicates` returns other addresses sharing the hash.

## POSTBOOK — original plan (see "built" below for what shipped)

A separate app in `apps/postbook`, same backend, no new API. Agreed shape:

- Login, then an alphabetically sorted, searchable address list (the paginated endpoint above).
- Tap a name → map centered on the user's own office by default, pin at that address's location.
- Add an address two ways: tap-a-pin-on-the-map, or a form (`Add Address` button) — both hit the same `POST /addresses`, they just collect `gpsLat`/`gpsLng` differently.
- Which of those two show up depends on role. Working assumption, not confirmed: **SPM maps to `office_admin`** in the existing three-role system (`super_admin` / `office_admin` / `field_operator`) — there's no dedicated SPM role today, and the app's roles don't map 1:1 to real India Post cadres (Postman, MTS, ASP, IP, PA, SA, OA, etc., per the CEPT notification's own eligibility list) generally. Worth confirming before the role-gating in the UI is built, since guessing wrong here means rebuilding permission checks later.
- Duplicate detection surfaces via the new endpoint above once an address is DigiLocker-verified — before that, there's no identity to match on yet.


## POSTBOOK — built

`apps/postbook`. Login → alphabetical, searchable, paginated address list, scoped to the user's own office → tap a name → map (office boundary + address pin) with verify actions and duplicate detection. Add via a button-triggered form, or via "Pin on Map" — both converge on the same form once a location is set. SPM = `office_admin`, confirmed.

Talks to the same `postman-api` — no new backend service. The four new/changed address endpoints this required (`GET /addresses/:id`, single-address fetch for direct navigation; `GET /addresses/:id/possible-duplicates`; the paginated list; and the two verify actions) are hand-called from `apps/postbook/src/lib/addresses-api.ts` rather than through the generated `@workspace/api-client-react` hooks, because that client is generated from `openapi.yaml` and hasn't been regenerated since this session's spec changes — run `pnpm --filter @workspace/api-spec run codegen` and those calls could be swapped for generated hooks afterward. Login still uses the generated `useLogin`/`useLogout` — those endpoints didn't change.

Deploys as its own Render service (`apps/postbook`), same `VITE_API_URL` pointed at `postman-api` as `postman` uses.

Deliberately not built: photo upload UI on the detail page (the backend route exists; no `<input type="file">` wired to it yet), and editing an existing address (only create + verify are wired).

## Not yet built

`POSTBOOK` as its own app/UI — admin-facing address verification and management currently has no frontend, only the API routes below. Office point-location, beat zones/landmarks, and the offline-sync engine (the `isSynced` fields exist on `visits`/`visitPhotos`/`operatorLocations` but the actual device-side queue was never written) are all separately scoped, none started.

## What's wired (not just schema)

- `POST/PUT /addresses` compute `digipin` from coordinates server-side; reject out-of-India coordinates with a 400 instead of silently storing garbage.
- `POST /addresses/:id/verify-digilocker` — simulated identity check.
- `POST /addresses/:id/verify` — separate admin data-verification (`office_admin`/`super_admin` only), sets `verifiedBy`/`verifiedAt`.
- `POST /addresses/:id/photo` — reference photo, via R2.
- `POST /visits/:id/photos` — evidence photo, via R2, `digipin` computed from the photo's own capture-time GPS (best-effort — a bad reading doesn't block the upload).
- `POST /visits/:id/sign-delivery` — simulated delivery signature (`digilocker` or `aadhaar_esign`), pulls the registered occupant's name/mobile from the linked address when one exists.
