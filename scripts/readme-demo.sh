#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAPE_REL="scripts/readme-demo.tape"
OUTPUT_REL="docs/assets/skill-check-demo.gif"
OUTPUT_FILE="${ROOT_DIR}/${OUTPUT_REL}"
CLI_ENTRY="${ROOT_DIR}/dist/cli/main.js"
COLOR_ENV=(
  FORCE_COLOR=3
  CLICOLOR_FORCE=1
  COLORTERM=truecolor
  TERM=xterm-256color
)

mkdir -p "${ROOT_DIR}/docs/assets"

if [[ ! -f "${CLI_ENTRY}" ]]; then
  echo "dist/cli/main.js not found. Building CLI..."
  pnpm --dir "${ROOT_DIR}" run build >/dev/null
fi

echo "Generating README demo GIF..."
run_with_clean_npm_env() {
  env \
    -u NO_COLOR \
    -u NODE_DISABLE_COLORS \
    -u npm_config_npm_globalconfig \
    -u npm_config_verify_deps_before_run \
    -u npm_config__jsr_registry \
    -u npm_config_store_dir \
    -u NPM_CONFIG_NPM_GLOBALCONFIG \
    -u NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN \
    -u NPM_CONFIG__JSR_REGISTRY \
    -u NPM_CONFIG_STORE_DIR \
    "${COLOR_ENV[@]}" \
    npm_config_loglevel=error \
    NPM_CONFIG_LOGLEVEL=error \
    "$@"
}

render_with_vhs() {
  local tape_path="$1"
  (cd "${ROOT_DIR}" && run_with_clean_npm_env vhs "${tape_path}")
}

render_with_docker() {
  local tape_path="$1"
  docker run --rm \
    -e FORCE_COLOR=3 \
    -e CLICOLOR_FORCE=1 \
    -e COLORTERM=truecolor \
    -e TERM=xterm-256color \
    -e NO_COLOR= \
    -e NODE_DISABLE_COLORS= \
    -e npm_config_loglevel=error \
    -e NPM_CONFIG_LOGLEVEL=error \
    -e TAPE_PATH="${tape_path}" \
    -v "${ROOT_DIR}:/vhs" \
    -w /vhs \
    --entrypoint bash \
    ghcr.io/charmbracelet/vhs:latest \
    -lc '
      set -euo pipefail
      unset NO_COLOR NODE_DISABLE_COLORS
      if ! command -v npx >/dev/null 2>&1; then
        apt-get update -o Acquire::AllowReleaseInfoChange=true >/dev/null
        apt-get install -y --no-install-recommends nodejs npm >/dev/null
      fi
      vhs "${TAPE_PATH}"
    '
}

render_tape() {
  local tape_path="$1"

  if command -v vhs >/dev/null 2>&1; then
    if render_with_vhs "${tape_path}"; then
      return 0
    fi
    echo "Local VHS failed; trying Docker fallback..."
  fi

  if command -v docker >/dev/null 2>&1; then
    render_with_docker "${tape_path}"
    return 0
  fi

  echo "Neither vhs nor docker is available." >&2
  echo "Install VHS (https://github.com/charmbracelet/vhs) or Docker, then re-run pnpm run demo:readme." >&2
  return 1
}

render_high_color_gif() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    return 1
  fi

  local temp_dir
  temp_dir="$(mktemp -d)"
  local temp_mp4="${temp_dir}/readme-demo.mp4"
  local temp_tape="${temp_dir}/readme-demo.mp4.tape"
  local palette_png="${temp_dir}/palette.png"

  awk -v output_path="${temp_mp4}" '
    BEGIN { replaced = 0 }
    {
      if (!replaced && $1 == "Output") {
        print "Output \"" output_path "\""
        replaced = 1
        next
      }
      print
    }
    END {
      if (!replaced) {
        print "Output \"" output_path "\""
      }
    }
  ' "${ROOT_DIR}/${TAPE_REL}" > "${temp_tape}"

  if ! render_tape "${temp_tape}"; then
    rm -rf "${temp_dir}"
    return 1
  fi

  if [[ ! -s "${temp_mp4}" ]]; then
    echo "High-fidelity render did not produce MP4 output." >&2
    rm -rf "${temp_dir}"
    return 1
  fi

  ffmpeg -y \
    -i "${temp_mp4}" \
    -vf "fps=12,palettegen=stats_mode=diff" \
    "${palette_png}" >/dev/null 2>&1

  ffmpeg -y \
    -i "${temp_mp4}" \
    -i "${palette_png}" \
    -lavfi "fps=12[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "${OUTPUT_FILE}" >/dev/null 2>&1

  local ffmpeg_status=$?
  rm -rf "${temp_dir}"
  return "${ffmpeg_status}"
}

if ! render_high_color_gif; then
  echo "High-fidelity path unavailable; using direct GIF render..."
  render_tape "${TAPE_REL}"
else
  echo "Used high-fidelity MP4->GIF pipeline."
fi

if [[ ! -s "${OUTPUT_FILE}" ]]; then
  echo "Expected output GIF not found or empty: ${OUTPUT_FILE}" >&2
  exit 1
fi

echo "Generated ${OUTPUT_REL}"
