# Builds the web app, the API and the map-data updater from the repository
# root. Used by deploy/docker-compose.yml (targets `web`, `api`, `updater`).

FROM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.34.6
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG SITE_URL=https://jetlag.sharankov.com
ARG BASE_PATH=/
ENV SITE_URL=$SITE_URL BASE_PATH=$BASE_PATH
RUN pnpm build && pnpm build:server && pnpm build:datasets

# Static site (plus the basemap file, mounted at /tiles).
FROM nginx:stable-alpine AS web
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Share links (and later, team sync). Data lives in /data.
FROM node:24-alpine AS api
WORKDIR /app
COPY --from=build /app/server/dist/index.mjs ./index.mjs
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "index.mjs"]

# Downloads map data and builds the reference datasets (see update-data.sh).
FROM node:24-bookworm-slim AS updater
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl jq osmium-tool \
    && rm -rf /var/lib/apt/lists/*
ARG PMTILES_VERSION=1.31.2
RUN curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" \
    | tar -xz -C /usr/local/bin pmtiles
COPY --from=build /app/server/dist/build-datasets.mjs /app/build-datasets.mjs
COPY deploy/update-data.sh /usr/local/bin/update-data
RUN chmod +x /usr/local/bin/update-data
ENTRYPOINT ["update-data"]
