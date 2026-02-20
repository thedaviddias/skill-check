import { describe, expect, it } from 'vitest';
import { renderHtml } from '../../src/core/html-report.js';
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
      output: { format: 'html' },
      failOnWarning: false,
      strictMode: false,
      lenientMode: false,
    },
    skills: [],
    diagnostics: [],
    summary: { skillCount: 1, errorCount: 0, warningCount: 0 },
    ...overrides,
  };
}

describe('renderHtml', () => {
  it('produces valid HTML with doctype', () => {
    const html = renderHtml(makeResult());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes summary section', () => {
    const html = renderHtml(makeResult());
    expect(html).toContain('Summary');
    expect(html).toContain('Skills');
  });

  it('includes PASS status for clean results', () => {
    const html = renderHtml(makeResult());
    expect(html).toContain('PASS');
  });

  it('includes FAIL status for results with errors', () => {
    const html = renderHtml(
      makeResult({
        summary: { skillCount: 1, errorCount: 2, warningCount: 0 },
      }),
    );
    expect(html).toContain('FAIL');
  });

  it('renders diagnostics grouped by file', () => {
    const html = renderHtml(
      makeResult({
        diagnostics: [
          {
            ruleId: 'test.rule',
            severity: 'error',
            message: 'something broke',
            file: 'skills/test/SKILL.md',
            line: 1,
            column: 1,
          },
        ],
        summary: { skillCount: 1, errorCount: 1, warningCount: 0 },
      }),
    );
    expect(html).toContain('skills/test/SKILL.md');
    expect(html).toContain('something broke');
    expect(html).toContain('test.rule');
  });

  it('renders suggestion text', () => {
    const html = renderHtml(
      makeResult({
        diagnostics: [
          {
            ruleId: 'test.rule',
            severity: 'warn',
            message: 'issue',
            suggestion: 'fix this way',
            file: 'a.md',
            line: 1,
            column: 1,
          },
        ],
        summary: { skillCount: 1, errorCount: 0, warningCount: 1 },
      }),
    );
    expect(html).toContain('fix this way');
  });

  it('includes quality scores when provided', () => {
    const html = renderHtml(makeResult(), [
      {
        skillId: 'test',
        relativePath: 'skills/test/SKILL.md',
        score: 85,
        breakdown: {
          frontmatter: 30,
          description: 25,
          body: 20,
          links: 10,
          file: 0,
        },
      },
    ]);
    expect(html).toContain('Quality Scores');
    expect(html).toContain('85');
  });

  it('omits quality scores section when scores are empty', () => {
    const html = renderHtml(makeResult(), []);
    expect(html).not.toContain('Quality Scores');
  });

  it('includes filter controls', () => {
    const html = renderHtml(makeResult());
    expect(html).toContain('filter');
  });

  it('escapes HTML in messages', () => {
    const html = renderHtml(
      makeResult({
        diagnostics: [
          {
            ruleId: 'test.rule',
            severity: 'error',
            message: '<script>alert("xss")</script>',
            file: 'a.md',
            line: 1,
            column: 1,
          },
        ],
        summary: { skillCount: 1, errorCount: 1, warningCount: 0 },
      }),
    );
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });
});
