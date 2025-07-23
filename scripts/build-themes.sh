#!/bin/bash
set -ex

echo "Building themes..."
pnpm tsx scripts/build-cursor-dark-kai-theme.ts
pnpm tsx scripts/build-catppuccin-mocha-kai-theme.ts
pnpm tsx scripts/build-kiro-dark-kai-theme.ts
pnpm tsx scripts/build-dark-modern-theme.ts
