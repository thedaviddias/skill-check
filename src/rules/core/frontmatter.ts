import type { RuleDefinition } from '../../types.js';

function normalizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/^['"]|['"]$/g, '').trim();
}

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
];
