# Contributing to skill-check

Thank you for your interest in contributing to skill-check! Every contribution matters, whether it's reporting a bug, suggesting a feature, improving documentation, or writing code. This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding New Rules](#adding-new-rules)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior through the channels described in the code of conduct.

## Getting Started

### Prerequisites

- **Node.js** >= 20 (check `.nvmrc` for the exact version)
- **pnpm** (the required version is specified in `package.json` under `packageManager`)

### Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/skill-check.git
   cd skill-check
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

   This also sets up git hooks automatically via lefthook (through the `prepare` script).

3. Verify everything works:

   ```bash
   pnpm run lint && pnpm run typecheck && pnpm run test
   ```

### Available Scripts

| Script | What it does |
|---|---|
| `pnpm run test` | Run all tests (Vitest) |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run lint` | Check code with Biome |
| `pnpm run format` | Auto-format all files with Biome |
| `pnpm run typecheck` | Run TypeScript type checking |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run dev` | Run the CLI in development mode (via tsx) |
| `pnpm run check` | Run skill-check on the project's own skills |
| `pnpm run smoke:cli` | Run full CLI smoke tests against fixtures |

## Development Workflow

### Code Style

This project uses [Biome](https://biomejs.dev/) for both linting and formatting. There is no ESLint or Prettier.

- **Indentation:** 2 spaces
- **Quotes:** single quotes for JavaScript/TypeScript
- **Auto-check:** Biome runs automatically on every commit via lefthook

You can format your code at any time:

```bash
pnpm run format
```

### Testing

- **Framework:** [Vitest](https://vitest.dev/)
- **Test locations:** `tests/unit/` and `tests/integration/`
- **Coverage thresholds:** 80% statements, 65% branches, 80% functions, 80% lines

All new features and bug fixes should include tests. Follow the existing patterns in the `tests/` directory.

### Pre-commit Hooks

Lefthook runs automatically on every commit:

1. **Biome check** — linting and formatting
2. **TypeScript typecheck** — catches type errors before they reach CI
3. **commitlint** — validates your commit message format (see [Commit Conventions](#commit-conventions))

If a hook fails, fix the issue and try committing again.

## Adding New Rules

skill-check is a linter with extensible rules. Here's how to add a new built-in rule:

### 1. Choose a rule category

Rules are organized by category in `src/rules/core/`:

| File | Category |
|---|---|
| `frontmatter.ts` | Frontmatter field validation |
| `description.ts` | Description content rules |
| `body.ts` | Body size and content rules |
| `file.ts` | File-level formatting rules |
| `links.ts` | Link resolution rules |

### 2. Implement the rule

A rule implements the `RuleDefinition` interface (defined in `src/types.ts`):

```typescript
{
  id: 'category.rule_name',           // dot-separated: category.snake_case
  description: 'What this rule checks.',
  defaultSeverity: 'warn',            // 'error' or 'warn'
  evaluate(skill, context) {
    // skill: SkillArtifact — the parsed SKILL.md file
    // context: RuleContext — config, limits, etc.
    // Return RuleFinding[] (empty array = rule passes)
    return [];
  },
}
```

Look at `src/rules/core/body.ts` for a clean example.

### 3. Register the rule

Add your rule to the exported array in the appropriate `src/rules/core/<category>.ts` file.

### 4. Add default severity

Add your rule's default severity to `DEFAULT_RULE_LEVELS` in `src/core/defaults.ts`:

```typescript
'category.rule_name': 'warn',
```

### 5. Write tests

Create or extend a test file in `tests/unit/`. Follow the naming pattern of existing tests (e.g., `body-rules.test.ts` for body rules).

### 6. Document the rule

- Add a row to the **Rules Reference** table in `README.md`
- Add the rule to `docs/rules.md`

### Writing plugin rules

For rules distributed as separate packages, see `docs/plugins.md`. Plugins export a `rules` array using the same `RuleDefinition` interface.

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by [commitlint](https://commitlint.js.org/).

| Prefix | When to use | Version impact |
|---|---|---|
| `feat:` | New feature | Minor bump |
| `fix:` | Bug fix | Patch bump |
| `docs:` | Documentation only | No release |
| `chore:` | Build process, tooling | No release |
| `refactor:` | Code change (no new feature, no bug fix) | No release |
| `test:` | Adding or fixing tests | No release |

Use `BREAKING CHANGE:` in the commit body/footer to trigger a major version bump.

**Examples:**

```
feat: add frontmatter.version_format validation rule
fix: handle missing trailing newline in empty files
docs: add section on writing custom plugins
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Verify everything passes locally:
   ```bash
   pnpm run lint && pnpm run typecheck && pnpm run test
   ```
4. Push your branch and open a PR against `main`
5. Describe **what** you changed and **why** in the PR description
6. Wait for CI to pass and a maintainer to review
7. Once merged, releases are handled automatically via [semantic-release](https://github.com/semantic-release/semantic-release)

## Reporting Issues

### Bugs

Please include:

- Steps to reproduce the issue
- Expected vs actual behavior
- Your Node.js version, pnpm version, and OS
- The SKILL.md content that triggers the bug (if applicable)

### Feature Requests

- Describe the use case and problem you're trying to solve
- Explain the expected behavior
- If proposing a new rule, include examples of what should pass and fail

Before opening a new issue, please check the [existing issues](https://github.com/thedaviddias/skill-check/issues) to avoid duplicates.

## Recognition

We use [all-contributors](https://allcontributors.org/) to recognize every kind of contribution. When your PR is merged, you'll be automatically added to the contributors table in the README.
For non-code contributions (for example design or ideas), maintainers can trigger `.github/workflows/contributors.yml` via `workflow_dispatch` and add you manually with the right contribution type.
