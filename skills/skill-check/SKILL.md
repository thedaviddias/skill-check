---
name: skill-check
description: "Use when the user wants to validate, lint, or audit agent skill files (SKILL.md). Checks frontmatter schema, validates required fields, detects formatting issues, scores quality 0-100, and reports errors with line numbers. Activate when they say 'validate these skills,' 'check this repo's skills,' 'lint SKILL.md files,' or 'audit skills in [repo URL].' Supports local paths and GitHub repo URLs."
---

# skill-check

Validate agent skill files (SKILL.md) using the skill-check tool. Supports local paths and GitHub repos.

## Installation

- **No install (recommended):** `npx skill-check` — runs the latest version via npm
- **Global (curl):** `curl -fsSL https://raw.githubusercontent.com/thedaviddias/skill-check/main/scripts/install.sh | bash`
- **Homebrew:** `brew tap thedaviddias/skill-check https://github.com/thedaviddias/skill-check` then `brew install skill-check`

If the user has not installed skill-check, default to `npx skill-check`.

## Local validation

1. Run: `npx skill-check check <path> --no-security-scan --format json` (lint only) or `npx skill-check check <path> --format json` (full check with security scan)
2. Parse JSON output for diagnostics (ruleId, severity, message, file, line)
3. Summarize: number of skills found, errors vs warnings, suggested fixes

Use `--format json` for programmatic parsing. Use default text format for direct user display.

## GitHub repo validation

1. Clone shallowly: `git clone --depth 1 <url> /tmp/skill-check-<short-hash>`
2. Run: `npx skill-check check /tmp/skill-check-<hash> --format json`
3. Report findings, then remove the temp directory

## Key commands

```bash
npx skill-check check [path]                      # validate + security scan
npx skill-check check [path] --no-security-scan   # lint only
npx skill-check check [path] --format json         # machine-readable output
npx skill-check check [path] --fix                 # auto-fix supported findings
npx skill-check new <name>                         # scaffold new skill
npx skill-check rules                              # list all built-in rules
npx skill-check report [path]                      # markdown health report
npx skill-check split-body [path]                  # preview section-based body split
```

## Interpreting results

- **error** — Spec or rule violation; must fix
- **warn** — Recommendation; may be acceptable in context
- **quality score** — 0-100 per skill, weighted: frontmatter 30%, description 30%, body 20%, links 10%, file 10%
- Exit code 0 = no errors; non-zero = validation failed or security issues found
