# skill-check

Linter for agent skill files — validates SKILL.md files against the spec with extensible custom rules.

## Install

```bash
npx skill-check check .
```

Global install via curl:

```bash
curl -fsSL https://raw.githubusercontent.com/thedaviddias/skill-check/main/scripts/install.sh | bash
```

Install via Homebrew:

```bash
brew tap thedaviddias/skill-check https://github.com/thedaviddias/skill-check
brew install skill-check
```

## Commands

| Command | Description |
|---|---|
| `skill-check check [path]` | Run validation (and optional security scan) |
| `skill-check new <name>` | Scaffold a new skill directory with SKILL.md template |
| `skill-check watch [path]` | Watch for changes and re-run validation on save |
| `skill-check diff <a> <b>` | Compare diagnostics between two skill directories |
| `skill-check report [path]` | Generate a markdown health report |
| `skill-check rules [id]` | List all rules, or show detail for a specific rule |
| `skill-check security-scan [path]` | Run security scan via agent-scan (mcp-scan) |
| `skill-check init` | Create `skill-check.config.json` template |

### check options

| Flag | Description |
|---|---|
| `--fix` | Apply safe automatic fixes for supported findings |
| `--fix --interactive` | Prompt before applying each fix (TTY only) |
| `--baseline <path>` | Compare against a previous JSON run and show new/fixed counts |
| `--format <fmt>` | Output format (see below) |
| `--no-open` | Skip auto-opening HTML reports |
| `--no-security-scan` | Skip the security scan |
| `--strict` | Treat warnings as errors |
| `--lenient` | Relax selected strict rules |
| `--fail-on-warning` | Exit non-zero when warnings exist |

## Output Formats

| Format | Description |
|---|---|
| `text` | Colorized terminal output with ASCII tables, severity badges, and quality scores (default) |
| `json` | Machine-readable output including quality scores and optional baseline diff |
| `sarif` | SARIF format for security tooling and GitHub Code Scanning |
| `html` | Self-contained HTML report with scores, filtering, and dark mode |
| `github` | `::error` / `::warning` annotations for GitHub Actions |

**HTML reports** are written to `skill-check-report.html` (or `output.reportPath`). In an interactive terminal the report opens in your browser automatically; use `--no-open` to skip.

**View locally:** `npx skill-check check . --format html` or open the file directly: `open skill-check-report.html` (macOS).

The `text` formatter includes quality score bars per skill, colorized severity badges, and boxed summaries.
An ASCII CLI banner is shown in interactive text mode; set `SKILL_CHECK_NO_BANNER=1` to disable it.

## Quality Scores

Every `check` run computes a quality score (0-100) per skill based on five weighted categories:

| Category | Weight | What it measures |
|---|---|---|
| Frontmatter | 30% | Required fields, naming, ordering |
| Description | 30% | Length, "Use when" phrasing |
| Body | 20% | Line/token limits |
| Links | 10% | Broken local and reference links |
| File | 10% | Trailing newlines, formatting |

Scores appear in `text`, `html`, and `json` output.

## Duplicate Detection

When multiple skills share the same `name` or identical `description`, `check` emits `duplicates.name` / `duplicates.description` warnings so agents can reliably differentiate skills.

## Baseline Comparison

Save a JSON run as a baseline and compare later:

```bash
npx skill-check check . --format json --no-security-scan > baseline.json
# ... make changes ...
npx skill-check check . --baseline baseline.json --no-security-scan
```

Output shows how many diagnostics are new, fixed, or unchanged.

## Quick Start

```bash
pnpm install
pnpm run check
pnpm run report
```

Generate real CLI outputs from multi-skill fixtures:

```bash
pnpm run smoke:cli
```

Smoke output files are written to `reports/smoke/`.
Smoke includes a real security scan run by default.
Smoke also includes a real `--fix` run on a temp copy of the failing mixed fixture.
You can control smoke output colors with `SMOKE_COLOR=always|auto|never`.
You can set `SMOKE_SECURITY_SCAN=0` to skip security smoke and `SMOKE_SECURITY_SCAN_RUNNER=auto|local|uvx|pipx` to choose the runner (default: `pipx`).
Use `SMOKE_SECURITY_SCAN_SKILLS=/path/to/skills` to override the skills path scanned in smoke mode.

Create config with guided setup:

```bash
npx skill-check init --interactive
```

## Security Scan

`skill-check` can validate repos or direct skills directories:

```bash
npx skill-check check /path/to/repo
npx skill-check check ~/.claude/skills
```

`check` runs the security scan by default.
If dependencies are missing, `skill-check` asks before installing in interactive terminals.
In non-interactive/CI environments, use `--allow-installs` to permit automatic installs.

Run security scan without UV by forcing `pipx`:

```bash
npx skill-check security-scan . --security-scan-runner pipx --allow-installs
```

Run validation + security scan in one pipeline step with explicit runner:

```bash
npx skill-check check . --security-scan-runner pipx
```

Skip security scan for local/offline linting:

```bash
npx skill-check check . --no-security-scan
```

Apply safe auto-fixes and then re-run validation:

```bash
npx skill-check check . --fix --no-security-scan
```

Interactively choose which fixes to apply:

```bash
npx skill-check check . --fix --interactive --no-security-scan
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

Use GitHub annotations in CI:

```bash
npx skill-check check . --format github --no-security-scan
```

Hard-block dependency installs:

```bash
npx skill-check check . --no-installs
```

## Auto-fix Coverage

`--fix` currently handles deterministic formatting/metadata issues:

- `frontmatter.required`
- `frontmatter.name_required`
- `frontmatter.description_required`
- `frontmatter.name_matches_directory`
- `frontmatter.name_slug_format`
- `frontmatter.field_order`
- `description.use_when_phrase`
- `description.min_recommended_length`
- `file.trailing_newline_single`

Rules requiring human intent (content quality, max-length trimming, broken links, or oversized bodies) remain manual and are reported after fixes are applied.

Use `--fix --interactive` for per-diagnostic approval prompts (requires TTY).

## GitHub Action

Use `skill-check` directly in workflows:

Marketplace status: not listed in GitHub Marketplace yet.
Supported usage today is direct repo tags (`uses: thedaviddias/skill-check@v1` or `@v1.x.y`).
See `docs/github-action-publishing.md` for the publication playbook.

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

Use `--format github` for inline annotations on PRs:

```yaml
      - run: npx skill-check check . --format github --no-security-scan
```

Enable security scan explicitly (default is disabled in the action):

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

Emit SARIF and upload to GitHub Code Scanning:

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

The action outputs:

- `exit-code`: CLI exit code
- `sarif-file`: absolute path to SARIF file when `format=sarif`
- `command`: full command used for execution

`format=sarif` cannot be combined with `security-scan=true` in the action because security scan output is not SARIF.

## Action Release Checklist

1. Ensure `main` contains the desired `action.yml` and `github-action/index.js`.
2. Create and push an immutable version tag (example: `v1.2.0`).
3. Move the major tag to the latest stable release (`v1` -> `v1.2.0` commit).
4. Verify a workflow using `uses: thedaviddias/skill-check@v1` resolves the updated action.

## Rules Reference

Run `skill-check rules` to see all built-in rules with severity and fixable status.
Run `skill-check rules <id>` for detail on a specific rule.

| Rule | Default | Fixable |
|---|---|---|
| `frontmatter.required` | error | yes |
| `frontmatter.name_required` | error | yes |
| `frontmatter.description_required` | error | yes |
| `frontmatter.name_matches_directory` | error | yes |
| `frontmatter.name_slug_format` | error | yes |
| `frontmatter.field_order` | error | yes |
| `description.max_length` | error | no |
| `description.use_when_phrase` | warn | yes |
| `description.min_recommended_length` | warn | yes |
| `body.max_lines` | error | no |
| `body.max_tokens` | warn | no |
| `file.trailing_newline_single` | warn | yes |
| `links.local_markdown_resolves` | warn | no |
| `links.references_resolve` | warn | no |
| `duplicates.name` | warn | no |
| `duplicates.description` | warn | no |

All rules emit actionable `suggestion` text to guide fixes.

## Docs

- `docs/quickstart.md`
- `docs/github-action-publishing.md`
- `docs/config.md`
- `docs/rules.md`
- `docs/plugins.md`
- `docs/migration-from-agent-forge.md`
