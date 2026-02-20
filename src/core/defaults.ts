import type { LimitsConfig, OutputConfig, RuleLevel } from '../types.js';

export const DEFAULT_INCLUDE = ['**/skills/*/SKILL.md'];

export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
];

export const DEFAULT_LIMITS: LimitsConfig = {
  maxDescriptionChars: 1024,
  maxBodyLines: 500,
  minDescriptionChars: 50,
  maxBodyTokens: 5000,
};

export const DEFAULT_OUTPUT: OutputConfig = {
  format: 'text',
};

export const DEFAULT_RULE_LEVELS: Record<string, RuleLevel> = {
  'frontmatter.required': 'error',
  'frontmatter.name_required': 'error',
  'frontmatter.description_required': 'error',
  'frontmatter.name_matches_directory': 'error',
  'frontmatter.name_slug_format': 'error',
  'frontmatter.field_order': 'error',
  'description.max_length': 'error',
  'description.use_when_phrase': 'warn',
  'description.min_recommended_length': 'warn',
  'body.max_lines': 'error',
  'body.max_tokens': 'warn',
  'file.trailing_newline_single': 'warn',
  'links.local_markdown_resolves': 'warn',
  'links.references_resolve': 'warn',
};
