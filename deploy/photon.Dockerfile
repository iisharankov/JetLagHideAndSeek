# Photon place search (https://github.com/komoot/photon), self-hosted with the
# Switzerland + Liechtenstein data dump. Same API as photon.komoot.io.
FROM eclipse-temurin:21-jre
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl zstd \
    && rm -rf /var/lib/apt/lists/*
ARG PHOTON_VERSION=1.3.0
RUN curl -fsSL -o /photon.jar \
    "https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar"
COPY deploy/photon-entrypoint.sh /usr/local/bin/photon-entrypoint
RUN chmod +x /usr/local/bin/photon-entrypoint
EXPOSE 2322
ENTRYPOINT ["photon-entrypoint"]
