import type { RuleDefinition } from '../../types.js';

function estimateTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const bodyRules: RuleDefinition[] = [
  {
    id: 'body.max_lines',
    description: 'Body should stay within configured line limit.',
    defaultSeverity: 'error',
    evaluate(skill, context) {
      const lines = skill.body.split(/\r?\n/).length;
      const max = context.config.limits.maxBodyLines;
      if (lines <= max) return [];
      return [
        {
          message: `body lines ${lines} exceeds max ${max}`,
          suggestion:
            `Run "npx skill-check split-body <skill-dir-or-file>" to preview section-based extraction into references/*.md, then re-run with "--write". ` +
            `For editorial cleanup, use docs/skills/split-into-references/SKILL.md ` +
            `(https://github.com/thedaviddias/skill-check/blob/main/docs/skills/split-into-references/SKILL.md).`,
        },
      ];
    },
  },
  {
    id: 'body.max_tokens',
    description: 'Body should stay within configured token limit.',
    defaultSeverity: 'warn',
    evaluate(skill, context) {
      const tokens = estimateTokens(skill.body);
      const max = context.config.limits.maxBodyTokens;
      if (tokens <= max) return [];
      return [
        {
          message: `body token estimate ${tokens} exceeds max ${max}`,
          suggestion: `Reduce body to ~${max} tokens or fewer. Token count is a whitespace-split approximation.`,
        },
      ];
    },
  },
];
