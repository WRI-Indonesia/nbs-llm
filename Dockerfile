# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

RUN npx prisma generate

# 🔐 Securely inject secret only during build
RUN --mount=type=secret,id=openai_api_key \
  export OPENAI_API_KEY=$(cat /run/secrets/openai_api_key) && \
  echo "🔧 Building Next.js with secure secret..." && \
  npm run build


# ----------------------------
# Final runtime image (no secrets)
# ----------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]