# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# CI Drift-Janitor — GitHub Container Action image
# ─────────────────────────────────────────────────────────────────────────────
#
# Design decisions:
#
#   BASE IMAGE: node:22-alpine pinned by digest. Alpine (musl) is safe here
#   because the janitor and @design-spec/compiler are pure TypeScript with zero
#   native addons. Saves ~100 MB vs bookworm-slim. Digest pin ensures
#   reproducible builds regardless of tag drift.
#
#   ROOT USER: GitHub Actions runs container actions as root and mounts the
#   checked-out repo (GITHUB_WORKSPACE) owned by runner uid 1001. A non-root
#   USER causes git "dubious ownership" errors on the mounted workspace. We stay
#   root but add `safe.directory *` globally so git operates on any mounted path.
#   This is the standard pattern for Docker container actions.
#
#   PID 1 / SIGNALS: tini (28 KB on alpine) ensures proper signal forwarding so
#   the Node process exits cleanly when the runner cancels the job. Without it,
#   node as PID 1 doesn't reap zombies or forward SIGTERM reliably.
#
#   CACHE MOUNTS: BuildKit --mount=type=cache on /root/.npm avoids re-downloading
#   packages on warm rebuilds when only source changes.
#
#   LOCKFILE: npm ci --omit=dev ensures deterministic, offline-after-fetch installs.
#   The lockfile (package-lock.json) is committed alongside this Dockerfile.
#
#   REPRODUCIBILITY MODEL: the base image is pinned by digest and npm deps by the
#   lockfile — those two layers are bit-reproducible. The apk layer pulls the
#   latest *patched* git/ca-certificates/tini within the base's alpine release
#   (3.23). This is deliberate: alpine garbage-collects old package versions from
#   its index, so hard `-rN` pins eventually break the build; floating within the
#   release auto-absorbs CVE patches. For lockstep apk pinning, pass the build
#   args below (e.g. --build-arg GIT_VERSION=2.52.0-r0); empty = latest-in-release.
#
# PUBLISH GATE: this image depends on @design-spec/compiler being live on npm at
# the version pinned in package.json. Publish the compiler FIRST, then build and
# release design-spec/janitor@v1.
# ─────────────────────────────────────────────────────────────────────────────

# ── Build stage: compile TypeScript → dist ────────────────────────────────────
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS build

WORKDIR /action

# 1. Install ALL deps (including devDependencies for tsc) — layer cached until
#    package.json or lockfile changes.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# 2. Copy source and compile. Source changes don't bust the dep-install layer.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage: minimal image with git + production deps ───────────────────
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runtime

# OCI metadata labels. Version comes from a build arg so it never drifts from
# package.json (pass --build-arg IMAGE_VERSION=$(node -p "require('./package.json').version")).
ARG IMAGE_VERSION=0.1.0
LABEL org.opencontainers.image.title="Design Spec Drift-Janitor" \
      org.opencontainers.image.description="GitHub Action: auto-commits design-token fixes onto PR branches" \
      org.opencontainers.image.source="https://github.com/design-spec/design-spec" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Design Spec"

# Install runtime system deps:
#   - git: the action shells out to git for add/commit/push --force-with-lease
#   - ca-certificates: HTTPS calls to api.github.com
#   - tini: proper PID 1 signal forwarding (28 KB)
# Versions float within the pinned alpine release for auto-CVE-patching; pass the
# *_VERSION build args to pin exactly (see REPRODUCIBILITY MODEL above).
ARG GIT_VERSION=
ARG CACERTS_VERSION=
ARG TINI_VERSION=
RUN apk add --no-cache \
      "git${GIT_VERSION:+=$GIT_VERSION}" \
      "ca-certificates${CACERTS_VERSION:+=$CACERTS_VERSION}" \
      "tini${TINI_VERSION:+=$TINI_VERSION}"

# Allow git to operate on any mounted workspace regardless of ownership.
# Required because GitHub Actions mounts GITHUB_WORKSPACE as uid 1001 but
# container actions run as root.
RUN git config --system --add safe.directory '*'

WORKDIR /action

# Production dependencies only — deterministic via lockfile.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund && \
    # Strip package managers from the final image — not needed at runtime.
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Copy compiled JS from build stage, excluding source maps (saves ~50% of dist
# size; stack traces still have file:line from tsc's inline references).
COPY --from=build /action/dist ./dist
RUN find ./dist -name '*.js.map' -delete

# tini as PID 1 ensures SIGTERM is forwarded to node and zombies are reaped.
ENTRYPOINT ["/sbin/tini", "--", "node", "/action/dist/action.js"]
