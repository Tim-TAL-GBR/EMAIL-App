FROM node:20-alpine AS base

# This Dockerfile is optimized for monorepo using pnpm

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Copy all packages
COPY packages/shared ./packages/shared
COPY server ./server

# Install dependencies and build
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# Production image
FROM base AS prod
# Only install production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Copy built outputs from the build stage
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/server/dist ./server/dist

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
