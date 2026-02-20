import type { RuleDefinition } from '../../types.js';

function getDescription(
  skill: Parameters<RuleDefinition['evaluate']>[0],
): string {
  if (!skill.frontmatter) return '';
  const value = skill.frontmatter.description;
  if (typeof value !== 'string') return '';
  return value.trim();
}

export const descriptionRules: RuleDefinition[] = [
  {
    id: 'description.max_length',
    description: 'Description must be within configured max length.',
    defaultSeverity: 'error',
    evaluate(skill, context) {
      const description = getDescription(skill);
      if (!description) return [];
      const max = context.config.limits.maxDescriptionChars;
      if (description.length <= max) return [];
      return [
        {
          message: `description length ${description.length} exceeds max ${max}`,
          suggestion: `Shorten description to ${max} characters or fewer.`,
        },
      ];
    },
  },
  {
    id: 'description.use_when_phrase',
    description: 'Description should include "Use when" phrasing.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      const description = getDescription(skill);
      if (!description) return [];
      if (/\buse\s+when\b/i.test(description)) return [];
      return [
        {
          message: 'description should contain "Use when" phrasing',
          suggestion:
            'Start description with "Use when" to help agents match this skill to user intent.',
        },
      ];
    },
  },
  {
    id: 'description.min_recommended_length',
    description: 'Description should meet recommended minimum length.',
    defaultSeverity: 'warn',
    evaluate(skill, context) {
      const description = getDescription(skill);
      if (!description) return [];
      const min = context.config.limits.minDescriptionChars;
      if (description.length >= min) return [];
      return [
        {
          message: `description is short (${description.length} chars), recommended min is ${min}`,
          suggestion: `Add more detail about when and why an agent should use this skill.`,
        },
      ];
    },
  },
];
