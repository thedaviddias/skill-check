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

function makeSkillRaw(
  frontmatter: Record<string, unknown> | null,
): SkillArtifact {
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath: '/tmp/skills/my-skill/SKILL.md',
    relativePath: 'skills/my-skill/SKILL.md',
    content: '',
    body: '',
    frontmatter,
    frontmatterRaw: '',
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
      maxNameChars: 64,
      maxCompatibilityChars: 500,
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

describe('description.non_empty', () => {
  const rule = descriptionRules.find((r) => r.id === 'description.non_empty')!;

  it('passes with a non-empty description', () => {
    expect(rule.evaluate(makeSkill('Use when testing.'), context)).toHaveLength(
      0,
    );
  });

  it('fails with whitespace-only description', async () => {
    const skill = makeSkill('   ');
    skill.frontmatter = { name: 'my-skill', description: '   ' };
    const findings = await rule.evaluate(skill, context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('empty or whitespace-only');
  });

  it('fails with empty string description', async () => {
    const skill = makeSkill('');
    skill.frontmatter = { name: 'my-skill', description: '' };
    const findings = await rule.evaluate(skill, context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('empty or whitespace-only');
  });

  it('skips when description is absent', () => {
    const skill = makeSkill('');
    skill.frontmatter = { name: 'my-skill' };
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('skips when no frontmatter', () => {
    const skill = makeSkill('');
    skill.frontmatter = null;
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('passes when description is a non-string value (coerced via String())', () => {
    expect(
      rule.evaluate(
        makeSkillRaw({ name: 'my-skill', description: 42 }),
        context,
      ),
    ).toHaveLength(0);
  });
});

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

  it('skips when description is not a string', () => {
    expect(
      rule.evaluate(
        makeSkillRaw({ name: 'my-skill', description: 42 }),
        context,
      ),
    ).toHaveLength(0);
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
