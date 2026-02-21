import type { RuleDefinition } from '../../types.js';

function normalizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/^['"]|['"]$/g, '').trim();
}

const KNOWN_FRONTMATTER_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

export const frontmatterRules: RuleDefinition[] = [
  {
    id: 'frontmatter.required',
    description: 'SKILL.md must have valid YAML frontmatter.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (skill.frontmatter) return [];
      return [
        {
          message:
            skill.parseError ??
            'missing or invalid YAML frontmatter (--- ... ---)',
          suggestion:
            'Add YAML frontmatter at the top: ---\\nname: my-skill\\ndescription: Use when ...\\n---',
          line: 1,
          column: 1,
        },
      ];
    },
  },
  {
    id: 'frontmatter.name_required',
    description: 'Frontmatter must include name.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      if (skill.frontmatter.name) return [];
      return [
        {
          message: 'missing frontmatter "name"',
          suggestion: `Add "name: ${skill.slug}" to frontmatter.`,
          line: 1,
          column: 1,
        },
      ];
    },
  },
  {
    id: 'frontmatter.description_required',
    description: 'Frontmatter must include description.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      if (skill.frontmatter.description) return [];
      return [
        {
          message: 'missing frontmatter "description"',
          suggestion:
            'Add a "description:" field. Start with "Use when" to explain triggers.',
          line: 1,
          column: 1,
        },
      ];
    },
  },
  {
    id: 'frontmatter.name_matches_directory',
    description: 'Frontmatter name must match skill directory slug.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      const name = normalizeName(skill.frontmatter.name);
      if (!name) return [];
      if (name === skill.slug) return [];
      return [
        {
          message: `name "${name}" does not match directory "${skill.slug}"`,
          suggestion: `Rename to "name: ${skill.slug}" or rename the directory to "${name}".`,
        },
      ];
    },
  },
  {
    id: 'frontmatter.name_slug_format',
    description: 'Frontmatter name must match slug spec.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      const name = normalizeName(skill.frontmatter.name);
      if (!name) return [];
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return [];
      return [
        {
          message: 'name must use lowercase letters, numbers, and hyphens only',
          suggestion: `Use "name: ${skill.slug}" (derived from directory name).`,
        },
      ];
    },
  },
  {
    id: 'frontmatter.name_max_length',
    description: 'Frontmatter name must not exceed 64 characters.',
    defaultSeverity: 'error',
    evaluate(skill, context) {
      if (!skill.frontmatter) return [];
      const name = normalizeName(skill.frontmatter.name);
      if (!name) return [];
      const max = context.config.limits.maxNameChars;
      if (name.length <= max) return [];
      return [
        {
          message: `name length ${name.length} exceeds max ${max}`,
          suggestion: `Shorten the name to ${max} characters or fewer.`,
        },
      ];
    },
  },
  {
    id: 'frontmatter.field_order',
    description: 'Frontmatter should list name before description.',
    defaultSeverity: 'error',
    evaluate(skill) {
      if (!skill.frontmatterRaw) return [];
      const nameIndex = skill.frontmatterRaw.indexOf('name:');
      const descriptionIndex = skill.frontmatterRaw.indexOf('description:');
      if (nameIndex === -1 || descriptionIndex === -1) return [];
      if (nameIndex < descriptionIndex) return [];
      return [
        {
          message: 'frontmatter field order should be: name, description',
          suggestion:
            'Reorder so "name:" comes before "description:" in frontmatter.',
        },
      ];
    },
  },
  {
    id: 'frontmatter.unknown_fields',
    description:
      'Frontmatter should only contain spec-defined fields (name, description, license, compatibility, metadata, allowed-tools).',
    defaultSeverity: 'warn',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      const unknown = Object.keys(skill.frontmatter).filter(
        (key) => !KNOWN_FRONTMATTER_FIELDS.has(key),
      );
      if (unknown.length === 0) return [];
      const plural = unknown.length === 1 ? 'field' : 'fields';
      return [
        {
          message: `unknown frontmatter ${plural}: ${unknown.join(', ')}`,
          suggestion: `The spec defines: ${[...KNOWN_FRONTMATTER_FIELDS].join(', ')}. Remove or rename unrecognized fields.`,
        },
      ];
    },
  },
  {
    id: 'frontmatter.compatibility_max_length',
    description:
      'Compatibility field must not exceed 500 characters when provided.',
    defaultSeverity: 'warn',
    evaluate(skill, context) {
      if (!skill.frontmatter) return [];
      const value = skill.frontmatter.compatibility;
      if (value === undefined || value === null) return [];
      if (typeof value !== 'string') return [];
      const max = context.config.limits.maxCompatibilityChars;
      if (value.trim().length <= max) return [];
      return [
        {
          message: `compatibility length ${value.trim().length} exceeds max ${max}`,
          suggestion: `Shorten the compatibility field to ${max} characters or fewer.`,
        },
      ];
    },
  },
  {
    id: 'frontmatter.metadata_string_values',
    description:
      'Metadata field must be a map of string keys to string values.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      const metadata = skill.frontmatter.metadata;
      if (metadata === undefined || metadata === null) return [];
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return [
          {
            message: 'metadata must be a key-value object',
            suggestion:
              'Use metadata as a YAML mapping, e.g. metadata:\\n  author: example-org',
          },
        ];
      }
      const nonStringKeys: string[] = [];
      for (const [key, val] of Object.entries(
        metadata as Record<string, unknown>,
      )) {
        if (typeof val !== 'string') nonStringKeys.push(key);
      }
      if (nonStringKeys.length === 0) return [];
      return [
        {
          message: `metadata values must be strings; non-string keys: ${nonStringKeys.join(', ')}`,
          suggestion:
            'Convert metadata values to strings, e.g. version: "1.0" instead of version: 1.0',
        },
      ];
    },
  },
  {
    id: 'frontmatter.allowed_tools_format',
    description: 'allowed-tools field must be a space-delimited string.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      if (!skill.frontmatter) return [];
      const value = skill.frontmatter['allowed-tools'];
      if (value === undefined || value === null) return [];
      if (typeof value === 'string') return [];
      return [
        {
          message: 'allowed-tools must be a string (space-delimited tool list)',
          suggestion:
            'Use a space-delimited string, e.g. allowed-tools: Bash(git:*) Read',
        },
      ];
    },
  },
];
