import { describe, expect, it } from 'vitest';
import { descriptionRules } from '../../src/rules/core/description.js';
import type { RuleContext, SkillArtifact } from '../../src/types.js';

function makeSkill(description: string): SkillArtifact {
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath: '/tmp/skills/my-skill/SKILL.md',
    relativePath: 'skills/my-skill/SKILL.md',
    content: '',
    body: '',
    frontmatter: { name: 'my-skill', description },
    frontmatterRaw: `name: my-skill\ndescription: ${description}`,
  };
}

const context: RuleContext = {
  config: {
    cwd: '/tmp',
    roots: ['.'],
    rootsAbs: ['/tmp'],
    include: [],
    exclude: [],
    limits: {
      maxDescriptionChars: 100,
      maxBodyLines: 500,
      minDescriptionChars: 20,
      maxBodyTokens: 5000,
    },
    rules: {},
    allowlist: [],
    plugins: [],
    output: { format: 'text' },
    failOnWarning: false,
    strictMode: false,
    lenientMode: false,
  },
  resolveRuleLevel: (_id, fallback) => fallback,
};

describe('description.max_length', () => {
  const rule = descriptionRules.find((r) => r.id === 'description.max_length')!;

  it('passes when within limit', () => {
    const findings = rule.evaluate(
      makeSkill('Use when testing things.'),
      context,
    );
    expect(findings).toHaveLength(0);
  });

  it('fails when exceeding limit', async () => {
    const long = 'a'.repeat(200);
    const findings = await rule.evaluate(makeSkill(long), context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toBeTruthy();
  });

  it('passes with empty description', () => {
    const skill = makeSkill('');
    skill.frontmatter = { name: 'my-skill', description: '' };
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });
});

describe('description.use_when_phrase', () => {
  const rule = descriptionRules.find(
    (r) => r.id === 'description.use_when_phrase',
  )!;

  it('passes when "Use when" is present', () => {
    expect(rule.evaluate(makeSkill('Use when testing.'), context)).toHaveLength(
      0,
    );
  });

  it('warns when "Use when" is missing', async () => {
    const findings = await rule.evaluate(
      makeSkill('This does something.'),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toContain('Use when');
  });
});

describe('description.min_recommended_length', () => {
  const rule = descriptionRules.find(
    (r) => r.id === 'description.min_recommended_length',
  )!;

  it('passes when long enough', () => {
    expect(
      rule.evaluate(
        makeSkill('Use when the skill is needed for testing purposes.'),
        context,
      ),
    ).toHaveLength(0);
  });

  it('warns when too short', async () => {
    const findings = await rule.evaluate(makeSkill('Use when short'), context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toBeTruthy();
  });
});
