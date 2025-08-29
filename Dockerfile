FROM node:20-alpine AS dependencies

# Create app group and user with specific UID/GID, and set up app directory
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup -s /sbin/nologin -h /home/appuser && \
    mkdir -p /app && chown -R appuser:appgroup /app

WORKDIR /app

# Copy package files as root without giving write permissions to appuser
COPY package*.json ./
RUN chown root:appgroup package*.json && chmod 644 package*.json && \
    npm ci --ignore-scripts && npm cache clean --force

# Copy application files as root with read-only permissions
COPY prisma/ ./prisma/
COPY src/ ./src/
COPY nest-cli.json ./
COPY tsconfig*.json ./
COPY eslint.config.mjs ./

# Generate Prisma client and build project first (while files are still writable)
RUN ls -la prisma/schema.prisma && \
    npx prisma generate && \
    npm run build && \
    chown -R root:appgroup . && \
    chmod -R o-rwx . && \
    find . -type f -exec chmod g-w {} \; && \
    find . -type d -exec chmod g-w {} \; && \
    mkdir -p /app/logs /app/temp && \
    chown appuser:appgroup /app/logs /app/temp && \
    chmod 755 /app/logs /app/temp

# Switch to non-root user for runtime
USER appuser

# Expose the correct port for your application
EXPOSE 7000

CMD ["npm", "run", "start:prod"]
