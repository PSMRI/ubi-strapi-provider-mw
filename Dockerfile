FROM node:20-alpine AS dependencies

# Create app group and user with specific UID/GID
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Create and set ownership of app directory
RUN mkdir -p /app && chown -R appuser:appgroup /app

WORKDIR /app

# Install all dependencies as root first (including dev dependencies for Prisma)
COPY --chown=appuser:appgroup package*.json ./
RUN npm ci && npm cache clean --force

# Copy application files with proper ownership
COPY --chown=appuser:appgroup prisma/ ./prisma/
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup nest-cli.json ./
COPY --chown=appuser:appgroup tsconfig*.json ./
COPY --chown=appuser:appgroup eslint.config.mjs ./

# Optional check to confirm schema exists, generate Prisma client and build project as root
RUN ls -la prisma/schema.prisma && \
    npx prisma generate && \
    npm run build

# Switch to non-root user for runtime
USER appuser

# Expose the correct port for your application
EXPOSE 7000

CMD ["npm", "run", "start:prod"]
