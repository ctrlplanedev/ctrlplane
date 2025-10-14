ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base

FROM base AS builder

RUN apk add --no-cache libc6-compat python3 make g++

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo
RUN npm install -g corepack@latest
RUN corepack enable pnpm

FROM builder AS installer

WORKDIR /app

COPY .gitignore .gitignore
COPY turbo.json turbo.json
RUN pnpm add -g turbo

COPY package.json package.json
COPY .npmrc .npmrc
COPY pnpm-*.yaml .

COPY tooling/tailwind/package.json ./tooling/tailwind/package.json
COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json

COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/validators/package.json ./packages/validators/package.json
COPY packages/job-dispatch/package.json ./packages/job-dispatch/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/secrets/package.json ./packages/secrets/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/rule-engine/package.json ./packages/rule-engine/package.json
COPY packages/workspace-engine-sdk/package.json ./packages/workspace-engine-sdk/package.json

COPY apps/webservice/package.json ./apps/webservice/package.json

RUN pnpm install --frozen-lockfile
COPY . .

RUN turbo build --filter=...@ctrlplane/webservice

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

COPY --from=installer --chown=nodejs:nodejs /app/apps/webservice/.next/standalone ./
COPY --from=installer --chown=nodejs:nodejs /app/apps/webservice/.next/static ./apps/webservice/.next/static
COPY --from=installer --chown=nodejs:nodejs /app/apps/webservice/public ./apps/webservice/public

EXPOSE 3000

ENV PORT=3000
ENV AUTH_TRUST_HOST=true
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/webservice/server.js"]
