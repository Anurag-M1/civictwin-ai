# ==============================================================================
# CivicTwin AI — Multi-Stage Production Dockerfile
# Digital Public Infrastructure & Governance Platform
# ==============================================================================

# Stage 1: Build Application
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma Client and build server + client
RUN npx prisma generate
RUN npm run build:server
RUN npm run build:client

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production

# Copy compiled artifacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/server/index.js"]
