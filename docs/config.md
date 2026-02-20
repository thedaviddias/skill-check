# Configuration

Default config file: `skill-check.config.json`

```json
{
  "roots": ["."],
  "include": ["**/skills/*/SKILL.md"],
  "exclude": ["**/node_modules/**", "**/.git/**"],
  "limits": {
    "maxDescriptionChars": 1024,
    "maxBodyLines": 500,
    "minDescriptionChars": 50,
    "maxBodyTokens": 5000
  },
  "rules": {
    "description.use_when_phrase": "warn",
    "body.max_tokens": "warn"
  },
  "allowlist": ["legacy/*"],
  "plugins": [],
  "output": {
    "format": "text"
  }
}
```

## Output Formats

Set `output.format` in config or use `--format` on the CLI:

| Format | Description |
|---|---|
| `text` | Colorized terminal output with quality scores (default) |
| `json` | Machine-readable output with scores and optional baseline diff |
| `sarif` | SARIF format for security tooling and GitHub Code Scanning |
| `html` | Self-contained HTML report with scores and filtering |
| `github` | `::error` / `::warning` annotations for GitHub Actions |

## Limits

| Key | Default | Description |
|---|---|---|
| `maxDescriptionChars` | 1024 | Maximum description character length |
| `minDescriptionChars` | 50 | Recommended minimum description length |
| `maxBodyLines` | 500 | Maximum body line count |
| `maxBodyTokens` | 5000 | Maximum body token estimate (whitespace-split) |

## Allowlist

The `allowlist` array accepts glob patterns to skip validation for matched skill IDs:

```json
{
  "allowlist": ["legacy/*", "deprecated-skill"]
}
```

## Rule Overrides

Override any rule severity in the `rules` map:

```json
{
  "rules": {
    "body.max_tokens": "off",
    "description.use_when_phrase": "error"
  }
}
```

Valid values: `"error"`, `"warn"`, `"off"`.
