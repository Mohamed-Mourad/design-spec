#!/usr/bin/env bash
# generate-lockfile.sh — Generate package-lock.json for the janitor Docker build.
#
# WHEN TO RUN: After publishing @design-spec/compiler to npm (the publish gate).
# This script creates a standalone lockfile that resolves the compiler from the
# registry (not the workspace symlink). The lockfile is committed alongside the
# Dockerfile for reproducible builds.
#
# Usage:
#   cd packages/janitor
#   ./generate-lockfile.sh
#
# Prerequisites:
#   - @design-spec/compiler must be published at the version in package.json
#   - npm >= 10 (uses lockfileVersion 3)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ Generating standalone lockfile for @design-spec/janitor..."
echo "  (requires @design-spec/compiler to be published on npm)"

# Generate lockfile without actually installing node_modules
npm install --package-lock-only --no-audit --no-fund

echo "✓ package-lock.json generated"
echo "  Commit this file alongside the Dockerfile."
echo ""
echo "  Verify with: npm ci --dry-run"
