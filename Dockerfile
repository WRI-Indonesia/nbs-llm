FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

RUN npx prisma generate
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]