# Multi-stage build for Next.js standalone output.
# NOTE: NEXT_PUBLIC_API_BASE is inlined into the client bundle at BUILD time,
# so it must be passed as a build arg (not a runtime env). Rebuild the image if
# the API URL changes.
FROM node:24-alpine AS builder
# Pin pnpm to match the repo (pnpm-workspace.yaml uses v10+ `allowBuilds`);
# corepack's bundled version can be too old to parse it.
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# standalone bundles only the server + traced deps; static/ and public/ are
# copied separately because Next does not include them in the trace.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
