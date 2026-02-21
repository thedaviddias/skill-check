# split-into-references

## Use when

Use when `skill-check` reports `body.max_lines` and you need to modularize a long `SKILL.md` into maintainable `references/*.md` docs after running `split-body`.

## Workflow

1. Run preview first:
   - `npx skill-check split-body <skill-dir-or-file>`
2. Apply deterministic split:
   - `npx skill-check split-body <skill-dir-or-file> --write`
3. Edit generated references docs to improve readability:
   - tighten headings so each file has one clear purpose
   - add a 1-3 line summary at the top of each references file
   - remove duplicated steps across references files
4. Keep `SKILL.md` concise:
   - preserve "Use when", constraints, and expected outcomes
   - keep `## References` links current and descriptive
5. Validate:
   - `npx skill-check check <skill-dir-or-file> --no-security-scan`

## Quality checklist

- The main `SKILL.md` stays short and scannable.
- Each references file is focused and linkable.
- Links under `## References` resolve and match file names.
- No critical instruction is lost during extraction.

## Before/After pattern

Before:
- one very long `SKILL.md` containing all operational details.

After:
- concise `SKILL.md` with intent + constraints + `## References`
- multiple `references/*.md` files for detailed procedures.
