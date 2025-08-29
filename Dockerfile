FROM node:20-alpine AS builder
RUN apk add --no-cache g++ libc6-compat make python3
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
COPY src/ ./src/
COPY nest-cli.json ./
COPY tsconfig*.json ./
COPY eslint.config.mjs ./
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
# Create app user/group
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup -s /sbin/nologin -h /home/appuser
WORKDIR /app
COPY --chown=root:appgroup --chmod=644 package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# Copy only runtime artifacts
COPY --chown=root:appgroup --chmod=755 prisma/ ./prisma/
COPY --from=builder --chown=root:appgroup --chmod=755 /app/dist/ ./dist/
COPY --from=builder --chown=root:appgroup --chmod=755 /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder --chown=root:appgroup --chmod=755 /app/node_modules/@prisma/client/ ./node_modules/@prisma/client/
RUN find prisma/ dist/ node_modules/.prisma/ node_modules/@prisma/client/ -type f -exec chmod 644 {} \; && \
    mkdir -p /app/logs /app/temp && chown appuser:appgroup /app/logs /app/temp && chmod 755 /app/logs /app/temp
USER appuser
EXPOSE 7000
CMD ["node", "dist/main.js"]