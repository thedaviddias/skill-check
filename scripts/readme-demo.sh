#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAPE_REL="scripts/readme-demo.tape"
OUTPUT_REL="docs/assets/skill-check-demo.gif"
OUTPUT_FILE="${ROOT_DIR}/${OUTPUT_REL}"
CLI_ENTRY="${ROOT_DIR}/dist/cli/main.js"

mkdir -p "${ROOT_DIR}/docs/assets"

if [[ ! -f "${CLI_ENTRY}" ]]; then
  echo "dist/cli/main.js not found. Building CLI..."
  pnpm --dir "${ROOT_DIR}" run build >/dev/null
fi

echo "Generating README demo GIF..."
if command -v vhs >/dev/null 2>&1; then
  (cd "${ROOT_DIR}" && vhs "${TAPE_REL}")
elif command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -v "${ROOT_DIR}:/vhs" \
    -w /vhs \
    ghcr.io/charmbracelet/vhs:latest \
    "${TAPE_REL}"
else
  echo "Neither vhs nor docker is available." >&2
  echo "Install VHS (https://github.com/charmbracelet/vhs) or Docker, then re-run pnpm run demo:readme." >&2
  exit 1
fi

if [[ ! -s "${OUTPUT_FILE}" ]]; then
  echo "Expected output GIF not found or empty: ${OUTPUT_FILE}" >&2
  exit 1
fi

echo "Generated ${OUTPUT_REL}"
