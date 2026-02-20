#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/reports/smoke"
CLI_ENTRY="${ROOT_DIR}/dist/cli/main.js"
SMOKE_COLOR="${SMOKE_COLOR:-always}"
SMOKE_SECURITY_SCAN="${SMOKE_SECURITY_SCAN:-1}"
SMOKE_SECURITY_SCAN_RUNNER="${SMOKE_SECURITY_SCAN_RUNNER:-pipx}"
SMOKE_SECURITY_SCAN_SKILLS="${SMOKE_SECURITY_SCAN_SKILLS:-${ROOT_DIR}/fixtures/pass/basic/global/skills}"
FIXTURE_FIX_DIR="$(mktemp -d "${TMPDIR:-/tmp}/skill-check-fix-smoke-XXXXXX")"

cleanup() {
  rm -rf "${FIXTURE_FIX_DIR}"
}
trap cleanup EXIT

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_DIR}"/*

echo "Building CLI..."
pnpm --dir "${ROOT_DIR}" run build >/dev/null

echo "Running real CLI smoke commands..."

run_cli() {
  case "${SMOKE_COLOR}" in
    always)
      env -u NO_COLOR FORCE_COLOR=1 node "${CLI_ENTRY}" "$@"
      ;;
    never)
      env -u FORCE_COLOR NO_COLOR=1 node "${CLI_ENTRY}" "$@"
      ;;
    auto)
      env -u FORCE_COLOR -u NO_COLOR node "${CLI_ENTRY}" "$@"
      ;;
    *)
      echo "Invalid SMOKE_COLOR value: ${SMOKE_COLOR}. Use always|auto|never." >&2
      exit 2
      ;;
  esac
}

run_cli check "${ROOT_DIR}/fixtures/pass/basic" --no-security-scan \
  | tee "${OUTPUT_DIR}/check-pass-basic.txt"

run_cli check "${ROOT_DIR}/fixtures/pass/multi" --no-security-scan \
  | tee "${OUTPUT_DIR}/check-pass-multi.txt"

if [[ "${SMOKE_SECURITY_SCAN}" == "1" ]]; then
  set +e
  run_cli check "${ROOT_DIR}/fixtures/pass/basic" \
    --allow-installs \
    --security-scan-runner "${SMOKE_SECURITY_SCAN_RUNNER}" \
    --security-scan-skills "${SMOKE_SECURITY_SCAN_SKILLS}" \
    | tee "${OUTPUT_DIR}/check-pass-basic-security-scan.txt"
  SECURITY_SCAN_CODE=$?
  set -e
  if [[ ${SECURITY_SCAN_CODE} -ne 0 ]]; then
    echo "Expected security scan smoke run to exit 0, got ${SECURITY_SCAN_CODE}" >&2
    exit 1
  fi
else
  echo "Skipping security scan smoke command (SMOKE_SECURITY_SCAN=${SMOKE_SECURITY_SCAN})."
fi

cp -R "${ROOT_DIR}/fixtures/fail/multi-mixed" "${FIXTURE_FIX_DIR}/multi-mixed"
run_cli check "${FIXTURE_FIX_DIR}/multi-mixed" --fix --no-security-scan \
  | tee "${OUTPUT_DIR}/check-fix-multi-mixed.txt"

set +e
run_cli check "${FIXTURE_FIX_DIR}/multi-mixed" --no-security-scan \
  | tee "${OUTPUT_DIR}/check-pass-after-fix-multi-mixed.txt"
POST_FIX_CODE=$?
set -e
if [[ ${POST_FIX_CODE} -ne 0 ]]; then
  echo "Expected post-fix validation to exit 0, got ${POST_FIX_CODE}" >&2
  exit 1
fi

set +e
run_cli check "${ROOT_DIR}/fixtures/fail/multi-mixed" --no-security-scan \
  | tee "${OUTPUT_DIR}/check-fail-multi-mixed.txt"
FAIL_CODE=$?
set -e
if [[ ${FAIL_CODE} -ne 1 ]]; then
  echo "Expected failing fixture to exit 1, got ${FAIL_CODE}" >&2
  exit 1
fi

set +e
run_cli check "${ROOT_DIR}/fixtures/fail/multi-mixed" --format json --no-security-scan \
  > "${OUTPUT_DIR}/check-fail-multi-mixed.json"
JSON_FAIL_CODE=$?
set -e
if [[ ${JSON_FAIL_CODE} -ne 1 ]]; then
  echo "Expected failing JSON run to exit 1, got ${JSON_FAIL_CODE}" >&2
  exit 1
fi

set +e
run_cli check "${ROOT_DIR}/fixtures/fail/multi-mixed" --format sarif --no-security-scan \
  > "${OUTPUT_DIR}/check-fail-multi-mixed.sarif.json"
SARIF_FAIL_CODE=$?
set -e
if [[ ${SARIF_FAIL_CODE} -ne 1 ]]; then
  echo "Expected failing SARIF run to exit 1, got ${SARIF_FAIL_CODE}" >&2
  exit 1
fi

# HTML report (--no-open because smoke runs with piped stdout, so no TTY and we don't auto-open)
set +e
run_cli check "${ROOT_DIR}/fixtures/fail/multi-mixed" --format html --no-open --no-security-scan
HTML_FAIL_CODE=$?
set -e
mv "${ROOT_DIR}/skill-check-report.html" "${OUTPUT_DIR}/check-fail-multi-mixed.html"
if [[ ${HTML_FAIL_CODE} -ne 1 ]]; then
  echo "Expected failing HTML run to exit 1, got ${HTML_FAIL_CODE}" >&2
  exit 1
fi

run_cli report "${ROOT_DIR}/fixtures/pass/multi" \
  > "${OUTPUT_DIR}/report-pass-multi.md"

echo "Smoke outputs written to:"
ls -1 "${OUTPUT_DIR}"
