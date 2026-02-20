---
name: skill-check
description: Use when the user wants to validate, lint, or audit agent skill files (SKILL.md). Use when they say "validate these skills," "check this repo's skills," "lint SKILL.md files," or "audit skills in [repo URL]." Run skill-check locally or against a cloned GitHub repo and summarize findings.
---

# skill-check

Validate agent skill files (SKILL.md) using the skill-check tool. Support both local paths and GitHub repos.

## Installation

Ensure skill-check is available before running checks:

- **No install (recommended for one-off or agent use):** `npx skill-check` — uses npm to run the latest version; requires Node.js and network on first run.
- **Global install (curl):** `curl -fsSL https://raw.githubusercontent.com/thedaviddias/skill-check/main/scripts/install.sh | bash` — installs a global `skill-check` binary.
- **Homebrew:** `brew tap thedaviddias/skill-check https://github.com/thedaviddias/skill-check` then `brew install skill-check`.

If the user has not installed skill-check, use `npx skill-check` so no prior install is needed. To confirm the tool is available, run `npx skill-check rules` and expect a list of built-in rule IDs.

## When to use

- User asks to validate, lint, or check skill files
- User provides a local path (e.g. `~/.cursor/skills`, `./skills`, or a repo root)
- User provides a GitHub repo URL and wants skills in that repo validated

## Local validation

1. Run skill-check against the given path:
   - Quick lint only: `npx skill-check check <path> --no-security-scan --format json`
   - Full check (includes security scan): `npx skill-check check <path> --format json`
2. Parse the JSON output to get diagnostics (ruleId, severity, message, file, line).
3. Summarize results for the user: number of skills found, errors vs warnings, and any suggested fixes.

Use `--format json` when you need to parse output programmatically. Use default text format when showing output directly to the user.

## GitHub repo validation

1. Clone the repo shallowly into a temp directory, e.g. `git clone --depth 1 <url> /tmp/skill-check-<short-hash>` (or use a system temp path).
2. Run `npx skill-check check /tmp/skill-check-<hash>` (with `--format json` if you will parse results).
3. Report findings to the user.
4. Remove the temp directory when done.

## Commands reference

- `npx skill-check check [path]` — run validation (+ optional security scan). Default path is `.`
- `npx skill-check check [path] --no-security-scan` — lint only, skip security scan
- `npx skill-check check [path] --format json` — machine-readable output with quality scores
- `npx skill-check check [path] --format github` — GitHub Actions `::error` / `::warning` annotations
- `npx skill-check check [path] --format html --no-open` — self-contained HTML report
- `npx skill-check check [path] --fix` — auto-fix supported findings
- `npx skill-check check [path] --fix --interactive` — prompt before each fix (TTY only)
- `npx skill-check check [path] --baseline baseline.json` — compare against previous run
- `npx skill-check new <name>` — scaffold a new skill directory
- `npx skill-check watch [path]` — re-run on file changes
- `npx skill-check diff <pathA> <pathB>` — compare diagnostics between two directories
- `npx skill-check rules` — list all built-in rules with severity and fixable status
- `npx skill-check rules <id>` — show detail for a specific rule
- `npx skill-check report [path]` — generate a markdown health report

## Interpreting results

- **error** — spec or rule violation; should be fixed.
- **warn** — recommendation; may be acceptable depending on context.
- **suggestion** — every diagnostic includes an actionable suggestion text.
- **quality score** — 0-100 per skill, weighted across frontmatter (30%), description (30%), body (20%), links (10%), file (10%).
- **duplicates** — `duplicates.name` / `duplicates.description` warnings when multiple skills share the same name or description.
- Exit code 0 means no errors; non-zero means validation failed or security scan found issues.

## Testing this skill

To verify this skill and the skill-check CLI work:

1. **Check CLI is available:** Run `npx skill-check rules`. You should see a list of built-in rules (e.g. `frontmatter.required`, `body.max_tokens`, etc.).
2. **Validate this repo's skills:** From the skill-check repo root, run `npx skill-check check skills/ --no-security-scan`. Expect one skill (`skills/skill-check/SKILL.md`) and zero diagnostics (PASS).
3. **Scaffold a test skill:** Run `npx skill-check new test-skill --dir /tmp`. Verify `/tmp/test-skill/SKILL.md` was created, then `npx skill-check check /tmp/test-skill --no-security-scan` should pass.
4. **Optional — validate with security scan:** Run `npx skill-check check skills/` (no `--no-security-scan`). Requires `mcp-scan` or `uv`/`pipx` for the security scan step.
