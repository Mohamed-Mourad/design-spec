# The CI Drift-Janitor action image.
#
# Self-contained: the janitor consumes @design-spec/compiler as a PUBLISHED,
# version-pinned npm artifact (the same contract the closed Figma plugin uses)
# — never shared source. The build context is just packages/janitor, so the
# compiler is resolved from the registry, not the workspace.
#
# PUBLISH GATE: this image build depends on @design-spec/compiler being live on
# npm at the version pinned in package.json. Per releasing-packages, publish the
# compiler FIRST; only then tag/release design-spec/janitor@v1.

# ---- build stage: compile TS -> dist ----
FROM node:22-bookworm-slim AS build
WORKDIR /action
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --no-audit --no-fund
RUN npm run build

# ---- runtime stage: git + production deps only ----
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /action
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /action/dist ./dist

ENTRYPOINT ["node", "/action/dist/action.js"]
