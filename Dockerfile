# Production image for the Next.js frontend.
# NEXT_PUBLIC_* values are inlined into the JS bundle at build time, so they
# are passed as build args, not runtime env vars:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://edura.example.com \
#                --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=... -t edura-frontend .

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_APP_NAME=Edura
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.js ./
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
