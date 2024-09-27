ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo
RUN corepack enable pnpm

COPY .gitignore .gitignore
COPY turbo.json turbo.json
RUN pnpm add -g turbo

COPY package.json package.json
COPY pnpm-*.yaml .

COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/node-sdk/package.json ./packages/node-sdk/package.json
COPY packages/validators/package.json ./packages/validators/package.json
COPY integrations/google-compute-scanner/package.json ./integrations/google-compute-scanner/package.json

RUN pnpm install --frozen-lockfile
COPY . .
RUN turbo build --filter=...@ctrlplane/google-compute-scanner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

CMD ["node", "integrations/google-compute-scanner/dist/index.js"]
