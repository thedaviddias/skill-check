---
name: brainstorming
description: "Use when starting creative work — planning features, scoping components, designing new functionality, or exploring behavior changes. Asks clarifying questions, identifies edge cases, drafts requirements, and proposes design approaches before any implementation begins. Activate when the user says 'plan a feature,' 'scope this work,' 'let's brainstorm,' 'design this,' or 'before we code.'"
---

# Brainstorming Ideas Into Designs

Turn ideas into fully formed designs through collaborative dialogue. Understand context, ask questions, propose approaches, and get approval before any implementation.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Workflow

1. **Explore context** — Read project files, docs, and recent commits to understand the current state
2. **Ask clarifying questions** — One question per message. Prefer multiple-choice when possible. Focus on purpose, constraints, and success criteria
3. **Propose 2-3 approaches** — Present options with trade-offs. Lead with your recommendation and explain why
4. **Present design** — Scale each section to complexity (a few sentences if simple, up to 200-300 words if nuanced). Ask after each section whether it looks right. Cover: architecture, components, data flow, error handling, testing
5. **Get approval** — If the user wants changes, revise and re-present. Do not proceed without explicit approval
6. **Write design doc** — Save to `docs/plans/YYYY-MM-DD-<topic>-design.md` and commit. Use elements-of-style:writing-clearly-and-concisely skill if available
7. **Transition** — Invoke the **writing-plans** skill to create an implementation plan. Do NOT invoke any other skill

## Key Principles

- **One question at a time** — Don't overwhelm with multiple questions
- **YAGNI ruthlessly** — Remove unnecessary features from all designs
- **Every project needs a design** — Even "simple" ones. A todo list, a config change — all of them. Unexamined assumptions on simple projects cause the most wasted work. The design can be short, but it must exist and be approved
- **Be flexible** — Go back and clarify when something doesn't fit
