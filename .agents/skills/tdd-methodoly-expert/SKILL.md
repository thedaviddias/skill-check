---
name: tdd-methodoly-expert
description: "Use when implementing features, fixing bugs, or refactoring with strict Test-Driven Development. Activate when the user mentions TDD, test-driven, red-green-refactor, test-first, or asks to write tests before implementation code."
---

# TDD Methodology Expert

Enforce the Red-Green-Refactor cycle throughout development. Every code change follows: write failing test → minimal implementation → refactor with green tests.

## Workflow

For every coding task:

1. **Break down** the requirement into small, testable behaviors
2. **🔴 Red** — Write a test for the next behavior. Run it. Verify it fails for the expected reason
3. **🟢 Green** — Write the minimum code to pass. Run all tests. Verify nothing broke
4. **🔵 Refactor** — Improve code and tests. Run all tests after each change
5. **Commit** — Save working, tested, clean code
6. **Repeat** — Next behavior, next test

**Never skip phases or reverse the order.** Every project goes through this — even "simple" ones.

## Communicate Progress

In every response involving code changes, state:

```
🔴 RED: Writing test for [behavior].
Expected failure: [reason].
→ Running... ❌ Fails as expected.

🟢 GREEN: Implementing minimal code.
→ Running... ✅ Passes. All tests pass.

🔵 REFACTOR: [what you improved].
→ Running... ✅ All tests still pass.
```

## Validation Checkpoints

- After Red: test must fail **for the right reason** (missing method, wrong value — not syntax error)
- After Green: **all** tests pass, not just the new one
- After Refactor: no test regressions; check for duplicated logic, unclear names, or structural issues
- Before commit: run full test suite

## Scope

**Use for:** implementing features, fixing bugs (write reproducing test first), refactoring with test protection, enforcing TDD discipline.

**Skip for:** pure design discussions, documentation-only tasks, research/exploration.

## Bundled Tools

### Scripts

- **`python scripts/check_tdd_compliance.py <path>`** — Detects TDD compliance issues: nested conditionals, long methods, complex booleans, missing abstractions, test coverage gaps. Run after completing a feature or before committing.

- **`python scripts/validate_tests.py <path>`** — Validates test structure: file existence, naming, Arrange-Act-Assert adherence, test size/complexity. Run before committing tests.

- **`bash scripts/setup_hooks.sh <project-dir>`** — Installs git pre-commit hook (TDD compliance check) and Claude Code hook (TDD reminders). Run once at project setup.

### References

Load when deeper guidance is needed:

- **[references/tdd-principles.md](references/tdd-principles.md)** — TDD philosophy, best practices, common mistakes, context-specific TDD (unit/integration/acceptance)
- **[references/code-smells.md](references/code-smells.md)** — Catalog of smells indicating test-after development, with detection patterns and refactoring guidance
- **[references/testing-patterns.md](references/testing-patterns.md)** — AAA, Given-When-Then, test doubles, parameterized testing, naming conventions
- **[references/tdd-reference.md](references/tdd-reference.md)** — Prompt-based validation, enforcement rules, troubleshooting
