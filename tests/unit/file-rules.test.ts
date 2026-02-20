import { describe, expect, it } from 'vitest';
import { fileRules } from '../../src/rules/core/file.js';
import type { RuleContext, SkillArtifact } from '../../src/types.js';

function makeSkill(content: string): SkillArtifact {
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath: '/tmp/skills/my-skill/SKILL.md',
    relativePath: 'skills/my-skill/SKILL.md',
    content,
    body: '',
    frontmatter: { name: 'my-skill' },
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

const trailingNewlineRule = fileRules.find(
  (r) => r.id === 'file.trailing_newline_single',
)!;

describe('file.trailing_newline_single', () => {
  it('passes with single trailing newline', () => {
    const findings = trailingNewlineRule.evaluate(
      makeSkill('content\n'),
      context,
    );
    expect(findings).toHaveLength(0);
  });

  it('warns when missing trailing newline', async () => {
    const findings = await trailingNewlineRule.evaluate(
      makeSkill('content'),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('should end with a newline');
    expect(findings[0]?.suggestion).toBeTruthy();
  });

  it('warns for multiple trailing newlines', async () => {
    const findings = await trailingNewlineRule.evaluate(
      makeSkill('content\n\n'),
      context,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('multiple trailing newlines');
    expect(findings[0]?.suggestion).toBeTruthy();
  });
});
