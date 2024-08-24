ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base


FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm install -g turbo


FROM base AS installer

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm install -g pnpm@$PNPM_VERSION

ARG PNPM_VERSION=9.4.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN corepack prepare pnpm@$PNPM_VERSION --activate

WORKDIR /app

COPY .gitignore .gitignore
COPY turbo.json turbo.json
RUN pnpm add -g turbo

COPY package.json package.json
COPY pnpm-*.yaml .

COPY tooling/tailwind/package.json ./tooling/tailwind/package.json
COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json

COPY packages/ui/package.json ./packages/ui/package.json

COPY apps/docs/package.json ./apps/docs/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/docs


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

COPY --from=installer --chown=nodejs:nodejs /app/apps/docs/.next/standalone ./
COPY --from=installer --chown=nodejs:nodejs /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=installer --chown=nodejs:nodejs /app/apps/docs/public ./apps/docs/public

EXPOSE 3000
ENV PORT=3000

CMD HOSTNAME="0.0.0.0" node apps/docs/server.js