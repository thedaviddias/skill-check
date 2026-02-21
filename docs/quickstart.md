# Quickstart

```bash
pnpm install
pnpm run check
pnpm run check:security
```

`check` runs the security scan by default. Skip it when needed:

```bash
npx skill-check check . --no-security-scan
```

Text output ends with a copy/try-friendly summary card that includes the exact `npx skill-check ...` command used for the run (including GitHub URL targets).

If the scan runner needs to install dependencies, automatic installs are enabled by default.
Use `--no-installs` to hard-block installs.

Run smoke checks with multiple real/fake fixture skills and save outputs:

```bash
pnpm run smoke:cli
```

Smoke runs a real security scan by default.
Smoke also runs `check --fix` on a temp copy of `fixtures/fail/multi-mixed` and then verifies it passes.
Default smoke security runner is `pipx`.

## README Demo Animation

For maintainers, regenerate the README animation with:

```bash
pnpm run demo:readme
```

The demo runs `npx skill-check .` from repo root so it auto-detects `.agents`/`.codex`/`.claude` style skill folders and includes a real security scan.
Source tape: `scripts/readme-demo.tape`.

For monochrome smoke output:

```bash
SMOKE_COLOR=never pnpm run smoke:cli
```

Skip security smoke or choose the runner:

```bash
SMOKE_SECURITY_SCAN=0 pnpm run smoke:cli
SMOKE_SECURITY_SCAN_RUNNER=pipx pnpm run smoke:cli
SMOKE_SECURITY_SCAN_SKILLS=/path/to/skills pnpm run smoke:cli
```

Install globally with curl:

```bash
curl -fsSL https://raw.githubusercontent.com/thedaviddias/skill-check/main/scripts/install.sh | bash
```

Install with Homebrew:

```bash
brew tap thedaviddias/skill-check https://github.com/thedaviddias/skill-check
brew install skill-check
```

Generate a config interactively:

```bash
npx skill-check init --interactive
```

Use against another repo:

```bash
npx skill-check /path/to/repo
```

Use directly against a GitHub repo URL (ephemeral shallow clone, auto-cleanup):

```bash
npx skill-check https://github.com/thedaviddias/skill-check --no-security-scan
npx skill-check https://github.com/thedaviddias/skill-check/tree/main/skills --no-security-scan
```

`--fix` is local-only for now when using GitHub URLs.

Apply safe automatic fixes:

```bash
npx skill-check check /path/to/repo --fix --no-security-scan
```

Interactively choose which fixes to apply:

```bash
npx skill-check check /path/to/repo --fix --interactive --no-security-scan
```

Scaffold a new skill:

```bash
npx skill-check new my-skill
```

Watch for changes during development:

```bash
npx skill-check watch . --no-security-scan
```

Compare two skill directories:

```bash
npx skill-check diff skills/ other-skills/
```

`watch` and `diff` currently support local paths only (not GitHub URLs).

Save a baseline and compare later:

```bash
npx skill-check check . --format json --no-security-scan > baseline.json
# ... make changes ...
npx skill-check check . --baseline baseline.json --no-security-scan
```

Use GitHub Actions annotations in CI:

```bash
npx skill-check check . --format github --no-security-scan
```

Use against a direct skills directory:

```bash
npx skill-check check ~/.claude/skills
```

Run security scan without UV:

```bash
npx skill-check security-scan . --security-scan-runner pipx
npx skill-check security-scan . --security-scan-runner pipx --no-installs
```

## GitHub Action Quickstart

Marketplace listing is currently deferred; direct `uses:` works now.

Basic usage:

```yaml
name: skill-check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: thedaviddias/skill-check@v1
        with:
          path: .
```

Enable security scan:

```yaml
name: skill-check-security

on:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: thedaviddias/skill-check@v1
        with:
          path: .
          security-scan: "true"
          security-scan-install-policy: allow
          security-scan-runner: pipx
```

Emit SARIF and upload to Code Scanning:

```yaml
name: skill-check-sarif

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: skillcheck
        uses: thedaviddias/skill-check@v1
        with:
          path: .
          format: sarif
          sarif-file: reports/skill-check.sarif.json
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ${{ steps.skillcheck.outputs.sarif-file }}
```

See also: `docs/github-action-publishing.md`.
