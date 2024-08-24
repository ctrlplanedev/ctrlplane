ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base


FROM base AS builder

RUN apk add --no-cache libc6-compat python3 make g++

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g turbo
RUN corepack enable pnpm


FROM builder AS installer

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

COPY packages/db/package.json ./packages/db/package.json
COPY packages/job-dispatch/package.json ./packages/job-dispatch/package.json

COPY apps/job-policy-checker/package.json ./apps/job-policy-checker/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN turbo build --filter=...@ctrlplane/job-policy-checker


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

COPY --from=installer --chown=nodejs:nodejs /app/apps/job-policy-checker/dist ./

EXPOSE 3000
ENV PORT=3000

CMD HOSTNAME="0.0.0.0" node apps/job-policy-checker/index.js