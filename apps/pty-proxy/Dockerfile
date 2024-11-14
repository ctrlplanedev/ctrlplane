ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine

RUN apk add --no-cache libc6-compat python3 make g++ bash nano

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo
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
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/job-dispatch/package.json ./packages/job-dispatch/package.json

COPY apps/pty-proxy/package.json ./apps/pty-proxy/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/pty-proxy

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

ENV NODE_ENV=production

WORKDIR apps/pty-proxy/dist/

CMD ["node", "index.js"]
