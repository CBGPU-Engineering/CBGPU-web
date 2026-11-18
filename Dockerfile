# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app
COPY . .
# Only PUBLIC, domain-stable browser configuration belongs in the build.
ARG NEXT_PUBLIC_SUPABASE_URL=https://cbgpu.com/backend
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1=0
ARG NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1=0
ARG CBGPU_RELEASE_SHA=source-review
ENV NEXT_TELEMETRY_DISABLED=1 CBGPU_WEB_STANDALONE=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1=$NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1 NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1=$NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1 CBGPU_RELEASE_SHA=$CBGPU_RELEASE_SHA
RUN node scripts/prepare-container-browser.mts /opt/cbgpu-browser
RUN test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" && npm run prebuild && node node_modules/next/dist/bin/next build --webpack && node scripts/prepare-container-server.mts

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:39c66687298417dbf3ff2fb8b6012c20554494e16414ef7afd07b9abbb45b501 AS runtime
WORKDIR /app
ARG CBGPU_RELEASE_SHA=source-review
LABEL org.opencontainers.image.revision=$CBGPU_RELEASE_SHA
ENV CBGPU_RELEASE_SHA=$CBGPU_RELEASE_SHA
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
ENV CBGPU_CHROMIUM_EXECUTABLE_PATH=/opt/cbgpu-browser/chromium LD_LIBRARY_PATH=/opt/cbgpu-browser/lib:/opt/cbgpu-browser FONTCONFIG_PATH=/opt/cbgpu-browser
COPY --from=build --chown=65532:65532 /app/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=build --chown=65532:65532 /app/public ./public
COPY --from=build --chown=65532:65532 /app/LICENSE /app/NOTICE /app/THIRD_PARTY_NOTICES.md ./
COPY --from=build --chown=65532:65532 /opt/cbgpu-browser /opt/cbgpu-browser
USER 65532:65532
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 CMD ["/nodejs/bin/node","-e","fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["scripts/serve.mts"]
