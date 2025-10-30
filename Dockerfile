# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Install deps with cache
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source and build
COPY . .

# 🔐 Securely inject secret only during build
RUN --mount=type=secret,id=openai_api_key \
  export OPENAI_API_KEY=$(cat /run/secrets/openai_api_key) && \
  echo "🔧 Building Next.js with secure secret..." && \
  npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts and prisma client
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package*.json ./

EXPOSE 3000
CMD ["npm", "run", "start"]