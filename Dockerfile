FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (e.g., node-gyp, tree-sitter deps)
RUN apk add --no-cache python3 make g++

# Copy package manifests and Prisma schema first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app (if present); no-op if not
RUN npm run build || true

ENV NODE_ENV=production

# Expose default Next.js port (safe no-op for worker-only usage)
EXPOSE 3000

# Default to starting the Next.js app; compose/runner can override CMD for worker
CMD ["npm", "run", "start"]


