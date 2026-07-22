FROM node:20-alpine AS base

# This Dockerfile is optimized for monorepo using pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Copy shared packages
COPY packages/shared ./packages/shared
# Copy mobile app
COPY apps/mobile ./apps/mobile

# Install dependencies and build
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the Web App
WORKDIR /app/apps/mobile
RUN pnpm exec expo export -p web

# Production Image: Nginx
FROM nginx:alpine AS prod

# Copy custom Nginx configuration
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built web assets from the build stage
COPY --from=build /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
