---
name: tdd-methodoly-expert
description: Use when implementing features or fixing bugs with strict Test-Driven Development (TDD). Activate for coding tasks that require new functionality, refactoring, or comprehensive test coverage, especially when the user mentions TDD or Test Driven Development.
---

# TDD Methodology Expert

Enforce and reinforce Test-Driven Development (TDD) methodology throughout the software development process. This skill provides comprehensive guidance, automated validation, and continuous reinforcement of the Red-Green-Refactor cycle.

## When to Use This Skill

This skill automatically activates when:
- TDD is mentioned in `CLAUDE.md` or `CLAUDE.local.md`
- TDD is referenced in project memory
- The user explicitly requests TDD methodology
- The user asks to write tests or implement features

Use this skill for:
- Implementing new features using TDD
- Refactoring existing code with test protection
- Fixing bugs with test-first approach
- Ensuring code quality through TDD discipline
- Validating that TDD principles are being followed

Do NOT use this skill for:
- Pure design discussions without implementation
- Documentation-only tasks
- Research or exploration tasks

## Core TDD Methodology

Test-Driven Development follows a strict three-phase cycle that must be repeated for every increment of functionality:

### 🔴 Red Phase: Write a Failing Test

**Always write the test before any production code.**

1. **Write a test** that expresses the desired behavior
2. **Run the test** and verify it fails (for the right reason)
3. **Confirm** the failure message indicates what's missing

**Red Phase Principles**:
- Test must be simple and focused on one behavior
- Test name should clearly describe expected behavior
- Test should be readable without looking at implementation
- Failure should be meaningful and guide implementation

**Example Flow**:
```
1. Write: test_should_calculate_total_with_tax()
2. Run: Test fails - "ShoppingCart has no attribute 'calculate_total'"
3. ✅ Ready for Green phase
```

### 🟢 Green Phase: Make the Test Pass

**Write minimal code to make the failing test pass.**

1. **Implement** the simplest code that makes the test pass
2. **Run the test** and verify it passes
3. **Run all tests** to ensure nothing broke

**Green Phase Principles**:
- Write only enough code to pass the current test
- Don't add features not required by tests
- It's okay to use shortcuts (you'll refactor later)
- Focus on making it work, not making it perfect

**Example Flow**:
```
1. Implement: def calculate_total(self, tax_rate): ...
2. Run: Test passes ✅
3. Run all: All tests pass ✅
4. ✅ Ready for Refactor phase
```

### 🔵 Refactor Phase: Improve the Code

**Clean up code while maintaining passing tests.**

1. **Identify** duplication, poor names, or structural issues
2. **Refactor** incrementally, running tests after each change
3. **Verify** all tests still pass
4. **Repeat** until code is clean

**Refactor Phase Principles**:
- Never refactor with failing tests
- Make small, safe changes
- Run tests after each refactoring step
- Improve both production code and test code
- Apply design patterns and best practices

**Example Flow**:
```
1. Identify: Duplicated tax calculation logic
2. Extract: Move to _calculate_tax() method
3. Run tests: All pass ✅
4. Improve: Better variable names
5. Run tests: All pass ✅
6. ✅ Commit and move to next feature
```

## TDD Workflow Integration

### Before Starting Any Code Task

**Step 1: Understand the Requirement**
- Break down the task into small, testable behaviors
- Identify the simplest test case to start with
- State which TDD phase you're entering (Red)

**Step 2: Plan the Test**
- Describe what test you're about to write
- Explain what behavior it will verify
- Confirm test will fail before implementation

### During Implementation

**Always follow this sequence**:

1. **🔴 Red**: Write failing test → Run → Verify failure
2. **🟢 Green**: Write minimal code → Run → Verify pass
3. **🔵 Refactor**: Improve code → Run → Verify still passes
4. **Commit**: Save working, tested, clean code
5. **Repeat**: Next test for next behavior

**Never skip phases or reverse the order.**

### Communicating TDD Progress

In every response involving code changes, explicitly state:
- **Current phase**: Which phase you're in (Red/Green/Refactor)
- **Test status**: Whether tests are passing or failing
- **Next steps**: What comes next in the cycle

**Example Communication**:
```
🔴 RED PHASE: Writing a test for calculating order total with discounts.

Test: test_should_apply_percentage_discount_to_order_total()
Expected to fail because Order.apply_discount() doesn't exist yet.

[Test code here]

Running test... ❌ Fails as expected: "Order has no attribute 'apply_discount'"

🟢 GREEN PHASE: Implementing minimal code to pass the test...

[Implementation code here]

Running test... ✅ Passes!
Running all tests... ✅ All pass!

🔵 REFACTOR PHASE: Improving the discount calculation structure...

[Refactored code here]

Running all tests... ✅ All pass!
Ready to commit this increment.
```

## Bundled Tools and Resources

### Scripts

#### check_tdd_compliance.py

Analyzes code to detect TDD compliance issues and code smells that indicate test-after development.

**Usage**:
```bash
python scripts/check_tdd_compliance.py <path-to-code>
```

**What it checks**:
- Nested conditionals (sign of poor TDD structure)
- Long methods (TDD produces small, focused methods)
- Complex boolean conditions (TDD encourages extraction)
- Missing abstractions (type checking vs polymorphism)
- Test coverage (presence of corresponding test files)

**When to use**:
- After completing a feature or module
- Before committing code
- When reviewing code quality
- During refactoring sessions

#### validate_tests.py

Validates that tests exist, are properly structured, and follow TDD patterns.

**Usage**:
```bash
python scripts/validate_tests.py <path-to-tests>
```

**What it checks**:
- Test file existence and structure
- Test case count and naming
- Arrange-Act-Assert pattern adherence
- Test size and complexity
- Descriptive test names

**When to use**:
- Before committing new tests
- When validating test quality
- During code review
- After writing a batch of tests

#### setup_hooks.sh

Installs git hooks and Claude Code hooks to enforce TDD methodology automatically.

**Usage**:
```bash
bash scripts/setup_hooks.sh <project-directory>
```

**What it installs**:
- Git pre-commit hook: Validates TDD compliance before commits
- Claude user-prompt-submit hook: Injects TDD reminders into every interaction
- Updates CLAUDE.md to document TDD requirement

**When to use**:
- Once at project initialization
- When onboarding new team members to TDD
- When setting up TDD enforcement for the first time

### References

Load these references when deeper understanding is needed:

#### tdd-principles.md

Comprehensive guide to TDD methodology including:
- The Red-Green-Refactor cycle in detail
- TDD philosophy and benefits
- Best practices and common mistakes
- TDD in different contexts (unit, integration, acceptance)
- Measuring TDD effectiveness

**When to reference**: When explaining TDD concepts or resolving questions about methodology.

#### code-smells.md

Catalog of code smells that indicate test-after development:
- High-severity smells (nested conditionals, long methods, god objects)
- Medium-severity smells (type checking, duplication, primitive obsession)
- Low-severity smells (magic numbers, long parameter lists)
- Detection strategies and refactoring guidance

**When to reference**: When analyzing code quality or identifying non-TDD patterns.

**Grep patterns for searching**:
- Nested conditionals: `if.*:\s*\n\s+if`
- Long methods: Count lines between function definitions
- Type checking: `isinstance\(|typeof `
- God classes: Count methods per class

#### testing-patterns.md

Language-agnostic testing patterns and best practices:
- Test structure patterns (AAA, Given-When-Then)
- Test organization (fixtures, builders, object mothers)
- Assertion patterns
- Test doubles (stubs, mocks, fakes)
- Parameterized testing
- Exception testing
- Test naming conventions

**When to reference**: When writing tests or improving test structure.

### Assets

#### Hook Templates

Located in `assets/hook-templates/`:

- **pre-commit.sh**: Git hook that runs TDD compliance checks before allowing commits
- **user-prompt-submit.sh**: Claude Code hook that injects TDD reminders before every user prompt

These templates are used by `setup_hooks.sh` and can be customized for specific project needs.


## Further reference

See [references/tdd-reference.md](references/tdd-reference.md) for prompt-based validation and setup, TDD enforcement rules, common scenarios, workflow integration, troubleshooting, and summary.
