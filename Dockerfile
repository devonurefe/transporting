# Stage 1: Build the frontend and backend assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies
RUN npm ci

# Generate Prisma Client
ENV DATABASE_URL="postgresql://placeholder_user:placeholder_password@localhost:5432/placeholder_db"
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Build Vite frontend and esbuild server
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package configs for runtime
COPY package*.json ./
COPY tsconfig.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Copy built artifacts and server configurations
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/prisma /app/prisma

# Run as the non-root "node" user built into the base image (not root)
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

# npm run start voert zelf al "prisma db push" uit en de server seedt een
# lege database automatisch (autoSeedIfEmpty in server.ts) — geen dubbele
# push/seed meer bij elke containerstart.
CMD ["sh", "-c", "npm run start"]
