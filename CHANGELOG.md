# Changelog

## Unreleased

- Add compatibility for scanning direct `skills` directories (for example, `~/.claude/skills`), including agent-scan style workflows.
- Add `agent-scan` CLI command and `check --agent-scan` pipeline integration.
- Add agent-scan runner selection (`auto`, `local`, `uvx`, `npx`) so security scans can run without UV.
- Add colorized text output with `picocolors`.
- Add `init --interactive` guided setup powered by `@clack/prompts`.
- Add a curl-installable script at `scripts/install.sh`.
- Add a Homebrew formula at `Formula/skill-check.rb`.
- Add multi-skill pass/fail fixtures with realistic and intentionally fake skills.
- Add `pnpm run smoke:cli` to run real CLI commands and write outputs under `reports/smoke/`.
- Improve text CLI visuals with colorized severity badges and ASCII report sections.
- Enable `agent-scan` by default for the `check` command, with `--no-agent-scan` opt-out.

## 0.1.0

- Initial release of `skill-check` CLI.
