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

## Deploying the frontends to GitHub Pages

`postman-api` cannot go here — GitHub Pages serves static files only, no server process. This deploys `postman` and `postbook` as static sites that still talk to `postman-api` on Render, unchanged.

Both apps now use hash-based routing (`/#/addresses`, not `/addresses`) specifically for this — GitHub Pages has no server-side rewrite, so a direct link to a non-hash client-side route would 404. `.github/workflows/deploy-pages.yml` builds both apps with `BASE_PATH` set to their own subpath and deploys them together, at:

- `https://<username>.github.io/daknet/postman/`
- `https://<username>.github.io/daknet/postbook/`

Two one-time steps only you can do, neither is in a file:
1. **Settings → Pages → Source: "GitHub Actions"** (not "Deploy from a branch" — that's the older mechanism this workflow doesn't use).
2. **Settings → Secrets and variables → Actions → Variables → add `VITE_API_URL`**, set to wherever `postman-api` is actually deployed on Render. The workflow reads this at build time — Vite bakes env vars into the static bundle, so this can't be changed after the fact without rebuilding.

After both are set, push to `main` (or run the workflow manually) and it deploys automatically from there.

CORS needed no change — `app.use(cors())` with no options already allows every origin, GitHub Pages' domain included. Worth knowing either way: that's wide open by design right now, not narrowed to specific origins — fine for where this is at, worth revisiting if it ever needs tightening.

## Deploying postman-api to Kubernetes (instead of Render)

Picked DigitalOcean Kubernetes over the other options: no trial-credit clock that turns into a surprise bill if a side project gets set aside for a few weeks (a real risk given how many things tend to be in flight at once), predictable small cost from day one instead, and the most beginner-documented managed K8s available. Oracle Cloud's free tier is real but has a well-known reputation for "out of capacity" errors on signup — not what you want for a first hands-on cluster.

**`apps/postman-api/Dockerfile`** — worth understanding why it's shaped the way it is: `build.mjs` already bundles `@workspace/db` and `@workspace/api-zod` directly into one `dist/index.mjs` file via esbuild, *except* for a handful of packages it deliberately excludes from bundling (see the `external` list in `build.mjs`) — for this app, that's just the AWS SDK, used for R2. So the runtime image doesn't need pnpm, the workspace, or any monorepo context at all — just that one file plus a plain `npm install` of the two AWS packages. Much simpler than pruning the whole workspace into the image, and it only works out this cleanly *because* of how build.mjs already externalizes things — worth knowing if another workspace dependency gets added later that also needs externalizing.

**One honest limit:** I can't run `docker build` here to confirm the image actually boots — no Docker daemon, no network in this sandbox. Verified everything I structurally could (the exact bundling/externalization behavior, the `pnpm deploy` alternatives, the build script name) but the real test is the first CI run actually completing.

**`k8s/secret.example.yaml`** vs **`k8s/deployment.yaml`** — split on purpose. The Deployment/Service get re-applied by CI on every push; the Secret does not, specifically so a real secret value never gets silently overwritten back to a placeholder by an automated deploy. Copy the example, fill in real values, apply it once by hand (or use the imperative `kubectl create secret` command in its comments, which never puts real values in a file at all).

**Account setup, in order:**
1. DigitalOcean account → Kubernetes → create a cluster (smallest node pool to start; scale later if it's actually under load).
2. Container Registry → create one (this is where built images live; the cluster pulls from here).
3. API → Generate New Token → this becomes the `DIGITALOCEAN_ACCESS_TOKEN` GitHub secret.
4. In the repo: Settings → Secrets and variables → Actions:
   - Secret `DIGITALOCEAN_ACCESS_TOKEN` = the token from step 3
   - Variable `DO_REGISTRY_NAME` = the registry name from step 2
   - Variable `DO_CLUSTER_NAME` = the cluster name from step 1
5. Apply the secret once (step above), then push to `main` — `.github/workflows/deploy-k8s.yml` builds, pushes, and rolls out from there automatically.

Render keeps running `postman-api` throughout this — nothing points `VITE_API_URL` at the new cluster until it's actually been proven to work.

## Not yet built

`POSTBOOK` as its own app/UI — admin-facing address verification and management currently has no frontend, only the API routes below. Office point-location, beat zones/landmarks, and the offline-sync engine (the `isSynced` fields exist on `visits`/`visitPhotos`/`operatorLocations` but the actual device-side queue was never written) are all separately scoped, none started.

## What's wired (not just schema)

- `POST/PUT /addresses` compute `digipin` from coordinates server-side; reject out-of-India coordinates with a 400 instead of silently storing garbage.
- `POST /addresses/:id/verify-digilocker` — simulated identity check.
- `POST /addresses/:id/verify` — separate admin data-verification (`office_admin`/`super_admin` only), sets `verifiedBy`/`verifiedAt`.
- `POST /addresses/:id/photo` — reference photo, via R2.
- `POST /visits/:id/photos` — evidence photo, via R2, `digipin` computed from the photo's own capture-time GPS (best-effort — a bad reading doesn't block the upload).
- `POST /visits/:id/sign-delivery` — simulated delivery signature (`digilocker` or `aadhaar_esign`), pulls the registered occupant's name/mobile from the linked address when one exists.
