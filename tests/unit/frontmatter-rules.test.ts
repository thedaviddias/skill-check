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

describe('frontmatter.name_required', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.name_required',
  )!;

  it('passes when name is present', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails when name is missing', async () => {
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: { description: 'test' } }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('missing frontmatter "name"');
    expect(findings[0]?.suggestion).toContain('my-skill');
  });

  it('skips when no frontmatter', () => {
    expect(
      rule.evaluate(makeSkill({ frontmatter: null }), context),
    ).toHaveLength(0);
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

describe('frontmatter.name_max_length', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.name_max_length',
  )!;

  it('passes when name is within limit', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails when name exceeds 64 characters', async () => {
    const longName = 'a'.repeat(65);
    const findings = await rule.evaluate(
      makeSkill({ frontmatter: { name: longName, description: 'test' } }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('exceeds max 64');
  });

  it('passes at exactly 64 characters', () => {
    const exactName = 'a'.repeat(64);
    expect(
      rule.evaluate(
        makeSkill({ frontmatter: { name: exactName, description: 'test' } }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('skips when no frontmatter', () => {
    expect(
      rule.evaluate(makeSkill({ frontmatter: null }), context),
    ).toHaveLength(0);
  });
});

describe('frontmatter.unknown_fields', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.unknown_fields',
  )!;

  it('passes with only known fields', () => {
    expect(
      rule.evaluate(
        makeSkill({
          frontmatter: {
            name: 'my-skill',
            description: 'test',
            license: 'MIT',
            compatibility: 'Designed for Claude Code',
            metadata: { author: 'test' },
            'allowed-tools': 'Bash(git:*) Read',
          },
        }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('warns on unknown fields', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          nmae: 'typo',
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('nmae');
  });

  it('lists multiple unknown fields', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          foo: 'bar',
          baz: 'qux',
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('foo');
    expect(findings[0]?.message).toContain('baz');
  });

  it('skips when no frontmatter', () => {
    expect(
      rule.evaluate(makeSkill({ frontmatter: null }), context),
    ).toHaveLength(0);
  });
});

describe('frontmatter.compatibility_max_length', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.compatibility_max_length',
  )!;

  it('passes when compatibility is within limit', () => {
    expect(
      rule.evaluate(
        makeSkill({
          frontmatter: {
            name: 'my-skill',
            description: 'test',
            compatibility: 'Requires git and docker',
          },
        }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('passes when compatibility is absent', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('fails when compatibility exceeds 500 characters', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          compatibility: 'x'.repeat(501),
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('exceeds max 500');
  });
});

describe('frontmatter.metadata_string_values', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.metadata_string_values',
  )!;

  it('passes with string values', () => {
    expect(
      rule.evaluate(
        makeSkill({
          frontmatter: {
            name: 'my-skill',
            description: 'test',
            metadata: { author: 'org', version: '1.0' },
          },
        }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('passes when metadata is absent', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('warns when metadata is not an object', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          metadata: 'not-an-object',
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('key-value object');
  });

  it('warns when metadata is an array', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          metadata: ['a', 'b'],
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('key-value object');
  });

  it('warns on non-string values', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          metadata: { author: 'org', version: 1.0, count: 42 },
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('version');
    expect(findings[0]?.message).toContain('count');
  });
});

describe('frontmatter.allowed_tools_format', () => {
  const rule = frontmatterRules.find(
    (r) => r.id === 'frontmatter.allowed_tools_format',
  )!;

  it('passes with string value', () => {
    expect(
      rule.evaluate(
        makeSkill({
          frontmatter: {
            name: 'my-skill',
            description: 'test',
            'allowed-tools': 'Bash(git:*) Read',
          },
        }),
        context,
      ),
    ).toHaveLength(0);
  });

  it('passes when allowed-tools is absent', () => {
    expect(rule.evaluate(makeSkill(), context)).toHaveLength(0);
  });

  it('warns when allowed-tools is an array', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          'allowed-tools': ['Bash', 'Read'],
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('must be a string');
  });

  it('warns when allowed-tools is a number', async () => {
    const findings = await rule.evaluate(
      makeSkill({
        frontmatter: {
          name: 'my-skill',
          description: 'test',
          'allowed-tools': 123,
        },
      }),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('must be a string');
  });
});
