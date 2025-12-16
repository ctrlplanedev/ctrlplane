ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base

RUN apk add --no-cache libc6-compat python3 make g++

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo serve
RUN npm install -g corepack@latest
RUN corepack enable pnpm

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
COPY tooling/typescript ./tooling/typescript

COPY packages/trpc/package.json ./packages/trpc/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/validators/package.json ./packages/validators/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/secrets/package.json ./packages/secrets/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/rule-engine/package.json ./packages/rule-engine/package.json
COPY packages/workspace-engine-sdk/package.json ./packages/workspace-engine-sdk/package.json

COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile
COPY . .

RUN turbo build --filter=...@ctrlplane/web

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app/apps/web

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["serve", "-s", "build/client", "-l", "3000"]