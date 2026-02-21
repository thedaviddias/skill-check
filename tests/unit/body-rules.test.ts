import { describe, expect, it } from 'vitest';
import { bodyRules } from '../../src/rules/core/body.js';
import type { RuleContext, SkillArtifact } from '../../src/types.js';

function makeSkill(body: string): SkillArtifact {
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath: '/tmp/skills/my-skill/SKILL.md',
    relativePath: 'skills/my-skill/SKILL.md',
    content: `---\nname: my-skill\n---\n${body}`,
    body,
    frontmatter: { name: 'my-skill', description: 'Use when testing.' },
    frontmatterRaw: 'name: my-skill',
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
      maxDescriptionChars: 1024,
      maxBodyLines: 10,
      minDescriptionChars: 50,
      maxBodyTokens: 20,
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

describe('body.max_lines', () => {
  const rule = bodyRules.find((r) => r.id === 'body.max_lines')!;

  it('passes when body is within limit', () => {
    const findings = rule.evaluate(makeSkill('line 1\nline 2'), context);
    expect(findings).toHaveLength(0);
  });

  it('fails when body exceeds limit', async () => {
    const longBody = Array.from({ length: 20 }, (_, i) => `line ${i}`).join(
      '\n',
    );
    const findings = await rule.evaluate(makeSkill(longBody), context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('exceeds max');
    expect(findings[0]?.suggestion).toBeTruthy();
    expect(findings[0]?.suggestion).toContain('split-body');
    expect(findings[0]?.suggestion).toContain(
      'docs/skills/split-into-references/SKILL.md',
    );
  });
});

describe('body.max_tokens', () => {
  const rule = bodyRules.find((r) => r.id === 'body.max_tokens')!;

  it('passes when body tokens are within limit', () => {
    const findings = rule.evaluate(makeSkill('just a few words'), context);
    expect(findings).toHaveLength(0);
  });

  it('fails when body tokens exceed limit', async () => {
    const longBody = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const findings = await rule.evaluate(makeSkill(longBody), context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('token estimate');
    expect(findings[0]?.suggestion).toContain('tokens');
  });
});
