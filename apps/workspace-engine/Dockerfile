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

COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/events/package.json ./packages/events/package.json

COPY apps/workspace-engine/package.json ./apps/workspace-engine/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/workspace-engine

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

ENV NODE_ENV=production
ENV NODE_MAX_OLD_SPACE_SIZE=4096

EXPOSE 3123

WORKDIR apps/workspace-engine/dist/

CMD ["node", "index.js"]
