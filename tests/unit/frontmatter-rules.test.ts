import { describe, expect, it } from 'vitest';
import { frontmatterRules } from '../../src/rules/core/frontmatter.js';
import type { RuleContext, SkillArtifact } from '../../src/types.js';

const context: RuleContext = {
  config: {
    cwd: '/tmp',
    roots: ['.'],
    rootsAbs: ['/tmp'],
    include: [],
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
  },
  resolveRuleLevel: (_id, fallback) => fallback,
};

function makeSkill(overrides: Partial<SkillArtifact> = {}): SkillArtifact {
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath: '/tmp/skills/my-skill/SKILL.md',
    relativePath: 'skills/my-skill/SKILL.md',
    content: '',
    body: '',
    frontmatter: { name: 'my-skill', description: 'Use when testing.' },
    frontmatterRaw: 'name: my-skill\ndescription: Use when testing.',
    ...overrides,
  };
}

describe('frontmatter.name_matches_directory', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.name_matches_directory',
  )!;

  it('passes when name matches slug', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails with suggestion when name mismatches', async () => {
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: { name: 'Wrong-Name', description: 'test' } }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toContain('my-skill');
  });

  it('skips when no frontmatter', () => {
    expect(
      rule.evaluate(makeSkill({ frontmatter: null }), context),
    ).toHaveLength(0);
  });

  it('skips when no name', () => {
    expect(
      rule.evaluate(
        makeSkill({ frontmatter: { description: 'test' } }),
        context,
      ),
    ).toHaveLength(0);
  });
});

describe('frontmatter.name_slug_format', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.name_slug_format',
  )!;

  it('passes for valid slug', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails for invalid slug', async () => {
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: { name: 'Not_Valid!', description: 'test' } }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toBeTruthy();
  });
});

describe('frontmatter.field_order', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.field_order',
  )!;

  it('passes when name before description', () => {
    expect(
      rule.evaluate(
        makeSkill({
          frontmatterRaw: 'name: my-skill\ndescription: test',
        }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('fails when description before name', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatterRaw: 'description: test\nname: my-skill',
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toContain('Reorder');
  });
});

describe('frontmatter.required', () => {
  const rule = frontmatterRules.find((r) => r.id === 'frontmatter.required')!;

  it('passes with valid frontmatter', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails with suggestion when missing', async () => {
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: null }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toContain('frontmatter');
  });
});

describe('frontmatter.description_required', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.description_required',
  )!;

  it('passes with description', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails with suggestion when missing', async () => {
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: { name: 'my-skill' } }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.suggestion).toContain('description');
  });
});
