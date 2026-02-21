# Built-in Rules

Run `skill-check rules` to see all rules with severity and fixable status.
Run `skill-check rules <id>` for detail on any specific rule.

| Rule | Default Severity | Fixable | Description |
|---|---|---|---|
| `frontmatter.required` | error | yes | SKILL.md must have valid YAML frontmatter |
| `frontmatter.name_required` | error | yes | Frontmatter must include name |
| `frontmatter.description_required` | error | yes | Frontmatter must include description |
| `frontmatter.name_matches_directory` | error | yes | Frontmatter name must match skill directory slug |
| `frontmatter.name_slug_format` | error | yes | Frontmatter name must match slug spec |
| `frontmatter.field_order` | error | yes | Frontmatter should list name before description |
| `description.max_length` | error | no | Description must be within configured max length |
| `description.use_when_phrase` | warn | yes | Description should include "Use when" phrasing |
| `description.min_recommended_length` | warn | yes | Description should meet recommended minimum length |
| `body.max_lines` | error | no | Body should stay within configured line limit |
| `body.max_tokens` | warn | no | Body should stay within configured token limit |
| `file.trailing_newline_single` | warn | yes | File should end with exactly one trailing newline |
| `links.local_markdown_resolves` | warn | no | Local markdown links should resolve |
| `links.references_resolve` | warn | no | references/* links should resolve within skill directory |
| `duplicates.name` | warn | no | Detected across skills when multiple share the same name |
| `duplicates.description` | warn | no | Detected across skills when descriptions are identical |

All rules emit actionable `suggestion` text alongside diagnostic messages.

## `body.max_lines` Remediation

When `body.max_lines` is reported, use the built-in split workflow:

```bash
# preview plan (no writes)
npx skill-check split-body <skill-dir-or-file>

# apply split
npx skill-check split-body <skill-dir-or-file> --write
```

How it works:

- Triggered only when body lines exceed the configured max.
- Extracts each major `##` section (including nested `###`) into `references/<slug>.md`.
- Rewrites the body to a compact `## References` index with links.
- If the body has no `##` headings, result is blocked with guidance to add headings first.

For editorial improvement after deterministic split, use `docs/skills/split-into-references/SKILL.md` or [the published copy](https://github.com/thedaviddias/skill-check/blob/main/docs/skills/split-into-references/SKILL.md).

## Auto-fix Support (`check --fix`)

Auto-fixable rules can be applied automatically or interactively:

```bash
# Apply all supported fixes
npx skill-check check . --fix --no-security-scan

# Prompt before each fix
npx skill-check check . --fix --interactive --no-security-scan
```

Manual-only rules require human intent (content quality, max-length trimming, broken links, or oversized bodies) and are reported after fixes are applied.

## Quality Scores

Every `check` run computes a quality score (0-100) per skill:

| Category | Weight |
|---|---|
| Frontmatter | 30% |
| Description | 30% |
| Body | 20% |
| Links | 10% |
| File | 10% |

Each error in a category zeroes that category's weight; each warning halves it. Scores appear in `text`, `html`, and `json` output.
