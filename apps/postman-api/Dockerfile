# syntax=docker/dockerfile:1.4

# Build stage — needs the full monorepo context because postman-api depends
# on @workspace/db and @workspace/api-zod via pnpm workspace links.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json ./
COPY apps/postman-api/package.json apps/postman-api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/api-spec/package.json packages/api-spec/package.json
COPY packages/api-zod/package.json packages/api-zod/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN pnpm install

COPY tsconfig.base.json tsconfig.json ./
COPY packages/database packages/database
COPY packages/api-zod packages/api-zod
COPY apps/postman-api apps/postman-api

RUN pnpm --filter @workspace/postman-api run build

# Runtime stage — esbuild already bundled @workspace/db and @workspace/api-zod
# straight into dist/index.mjs. The ONLY things that file still needs from
# node_modules at runtime are the packages build.mjs deliberately excludes
# from bundling (see the `external` list there) — for this app, that's just
# the AWS SDK (used for R2). Everything else got inlined, so this stage
# doesn't need pnpm, the workspace, or any monorepo context at all.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN npm install --omit=dev @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

COPY --from=build /repo/apps/postman-api/dist/index.mjs ./index.mjs

RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 3000
CMD ["node", "index.mjs"]
