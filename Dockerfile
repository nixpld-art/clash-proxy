FROM node:20-slim

# Install dumb-init for proper signal handling (ensures SIGTERM reaches Node)
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer-cached separately from source)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Render injects PORT at runtime; default to 8080 for local Docker runs
ENV PORT=8080
EXPOSE 8080

# dumb-init forwards SIGTERM → node so graceful shutdown works on Render
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
