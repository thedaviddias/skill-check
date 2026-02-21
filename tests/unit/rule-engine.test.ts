import { describe, expect, it } from 'vitest';
import { runRuleEngine } from '../../src/core/rule-engine.js';
import type {
  ResolvedConfig,
  RuleDefinition,
  SkillArtifact,
} from '../../src/types.js';

const skill: SkillArtifact = {
  id: 'global/my-skill',
  category: 'global',
  slug: 'my-skill',
  filePath: '/tmp/global/skills/my-skill/SKILL.md',
  relativePath: 'global/skills/my-skill/SKILL.md',
  content: '',
  body: '',
  frontmatter: { name: 'my-skill', description: 'Use when testing.' },
  frontmatterRaw: 'name: my-skill\ndescription: Use when testing.',
};

const fakeRule: RuleDefinition = {
  id: 'custom.rule',
  description: 'fake',
  defaultSeverity: 'warn',
  evaluate: () => [{ message: 'warning from fake rule' }],
};

const baseConfig: ResolvedConfig = {
  cwd: process.cwd(),
  roots: ['.'],
  rootsAbs: [process.cwd()],
  include: ['**/SKILL.md'],
  exclude: [],
  limits: {
    maxDescriptionChars: 1024,
    maxBodyLines: 500,
    minDescriptionChars: 50,
    maxBodyTokens: 5000,
  },
  rules: {},
  allowlist: [],
  plugins: [],
  output: { format: 'text' },
  failOnWarning: false,
  strictMode: false,
  lenientMode: false,
};

describe('runRuleEngine', () => {
  it('suppresses allowlisted skills', async () => {
    const diagnostics = await runRuleEngine([skill], [fakeRule], {
      ...baseConfig,
      allowlist: ['global/*'],
    });

    expect(diagnostics).toHaveLength(0);
  });

  it('upgrades warnings in strict mode', async () => {
    const diagnostics = await runRuleEngine([skill], [fakeRule], {
      ...baseConfig,
      strictMode: true,
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
  });
});
