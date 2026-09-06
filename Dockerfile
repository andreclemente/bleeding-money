FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/server/db ./server/db
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && node .output/server/index.mjs"]
