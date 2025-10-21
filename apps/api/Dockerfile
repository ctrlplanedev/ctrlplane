ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine

RUN apk add --no-cache libc6-compat python3 make g++ bash nano

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
COPY pnpm-*.yaml .

COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json

COPY packages/db/package.json ./packages/db/package.json
COPY packages/validators/package.json ./packages/validators/package.json
COPY packages/secrets/package.json ./packages/secrets/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/job-dispatch/package.json ./packages/job-dispatch/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/rule-engine/package.json ./packages/rule-engine/package.json
COPY packages/workspace-engine-sdk/package.json ./packages/workspace-engine-sdk/package.json

COPY apps/pty-proxy/package.json ./apps/pty-proxy/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/pty-proxy

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

ENV NODE_ENV=production

WORKDIR /app/apps/pty-proxy/dist/

CMD ["node", "index.js"]
