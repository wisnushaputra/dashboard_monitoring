# Backend Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# Compile seed script to JS so we don't need tsx in production
RUN npx tsx --tsconfig tsconfig.json -e "console.log('tsx available')" 2>/dev/null; \
    node -e " \
      const fs = require('fs'); \
      const seed = fs.readFileSync('prisma/seed.ts', 'utf8'); \
      const out = seed \
        .replace(/import\s+\{([^}]+)\}\s+from\s+'([^']+)'/g, \"const {\$1} = require('\$2')\") \
        .replace(/import\s+(\w+)\s+from\s+'([^']+)'/g, \"const \$1 = require('\$2')\"); \
      fs.writeFileSync('prisma/seed.js', out); \
    "

# Production
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl iputils
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node dist/server.js"]
