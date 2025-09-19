# https://github.com/WhiskeySockets/Baileys/issues/1003#issuecomment-2306467419
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine

RUN apk add --no-cache libc6-compat python3 make g++ curl

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo
RUN npm install -g corepack@latest
RUN corepack enable pnpm

WORKDIR /app

COPY .gitignore .gitignore
COPY turbo.json turbo.json
RUN pnpm add -g turbo

COPY package.json package.json
COPY .npmrc .npmrc
COPY pnpm-*.yaml .

COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json

COPY packages/db/package.json ./packages/db/package.json
COPY packages/validators/package.json ./packages/validators/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/job-dispatch/package.json ./packages/job-dispatch/package.json
COPY packages/rule-engine/package.json ./packages/rule-engine/package.json
COPY packages/secrets/package.json ./packages/secrets/package.json
COPY packages/events/package.json ./packages/events/package.json

COPY apps/event-queue/package.json ./apps/event-queue/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/event-queue

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=81920"

EXPOSE 3124

WORKDIR /app/apps/event-queue/dist/

CMD ["node", "-r", "./instrumentation-node.js", "index.js"]