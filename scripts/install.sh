#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${SKILL_CHECK_PACKAGE_NAME:-skill-check}"
PACKAGE_VERSION="${SKILL_CHECK_VERSION:-latest}"
GITHUB_REPO="${SKILL_CHECK_GITHUB_REPO:-thedaviddias/skill-check}"
SOURCE="${SKILL_CHECK_SOURCE:-npm}"

usage() {
  cat <<'EOF'
Install skill-check globally.

Usage:
  install.sh [--source npm|github|auto] [--version <version>] [--github-repo <owner/repo>]

Environment variables:
  SKILL_CHECK_SOURCE       npm|github|auto (default: npm)
  SKILL_CHECK_VERSION      package version or git ref (default: latest)
  SKILL_CHECK_GITHUB_REPO  GitHub repo for github source (default: thedaviddias/skill-check)
  SKILL_CHECK_PACKAGE_NAME npm package name (default: skill-check)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    --version)
      PACKAGE_VERSION="${2:-}"
      shift 2
      ;;
    --github-repo)
      GITHUB_REPO="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js first, then rerun this script." >&2
  exit 1
fi

install_from_npm() {
  npm install --global "${PACKAGE_NAME}@${PACKAGE_VERSION}"
}

install_from_github() {
  local ref=""
  if [[ "${PACKAGE_VERSION}" != "latest" ]]; then
    ref="#${PACKAGE_VERSION}"
  fi
  npm install --global "github:${GITHUB_REPO}${ref}"
}

case "${SOURCE}" in
  npm)
    install_from_npm
    ;;
  github)
    install_from_github
    ;;
  auto)
    if ! install_from_npm; then
      echo "npm install failed; falling back to GitHub source..." >&2
      install_from_github
    fi
    ;;
  *)
    echo "Invalid source: ${SOURCE}. Use npm, github, or auto." >&2
    exit 2
    ;;
esac

if ! command -v skill-check >/dev/null 2>&1; then
  echo "Installation finished, but skill-check is not on PATH." >&2
  echo "Ensure your global npm bin directory is in PATH." >&2
  exit 1
fi

echo "skill-check installed successfully."
