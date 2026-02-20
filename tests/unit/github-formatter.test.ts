import { describe, expect, it } from 'vitest';
import { toGitHubAnnotations } from '../../src/core/github-formatter.js';
import type { AnalysisResult } from '../../src/types.js';

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
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
    skills: [],
    diagnostics: [],
    summary: { skillCount: 0, errorCount: 0, warningCount: 0 },
    ...overrides,
  };
}

describe('toGitHubAnnotations', () => {
  it('returns empty string with no diagnostics', () => {
    expect(toGitHubAnnotations(makeResult())).toBe('');
  });

  it('formats errors as ::error annotations', () => {
    const result = makeResult({
      diagnostics: [
        {
          ruleId: 'frontmatter.required',
          severity: 'error',
          message: 'missing frontmatter',
          file: 'skills/test/SKILL.md',
          line: 1,
          column: 1,
        },
      ],
    });
    const output = toGitHubAnnotations(result);
    expect(output).toContain('::error file=skills/test/SKILL.md');
    expect(output).toContain('title=frontmatter.required');
    expect(output).toContain('missing frontmatter');
  });

  it('formats warnings as ::warning annotations', () => {
    const result = makeResult({
      diagnostics: [
        {
          ruleId: 'description.use_when_phrase',
          severity: 'warn',
          message: 'missing phrase',
          file: 'skills/test/SKILL.md',
          line: 2,
          column: 5,
        },
      ],
    });
    const output = toGitHubAnnotations(result);
    expect(output).toContain(
      '::warning file=skills/test/SKILL.md,line=2,col=5',
    );
  });

  it('includes suggestion text when present', () => {
    const result = makeResult({
      diagnostics: [
        {
          ruleId: 'test.rule',
          severity: 'error',
          message: 'broken',
          suggestion: 'fix it',
          file: 'a.md',
          line: 1,
          column: 1,
        },
      ],
    });
    const output = toGitHubAnnotations(result);
    expect(output).toContain('broken (fix it)');
  });

  it('outputs one line per diagnostic', () => {
    const result = makeResult({
      diagnostics: [
        {
          ruleId: 'a',
          severity: 'error',
          message: 'one',
          file: 'a.md',
          line: 1,
          column: 1,
        },
        {
          ruleId: 'b',
          severity: 'warn',
          message: 'two',
          file: 'b.md',
          line: 2,
          column: 1,
        },
      ],
    });
    const lines = toGitHubAnnotations(result).trim().split('\n');
    expect(lines).toHaveLength(2);
  });
});
