import { describe, expect, it } from 'vitest';
import { computeSkillScores } from '../../src/core/quality-score.js';
import type { Diagnostic, SkillArtifact } from '../../src/types.js';

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
    frontmatterRaw: 'name: my-skill',
    ...overrides,
  };
}

describe('computeSkillScores', () => {
  it('returns 100 for skill with no diagnostics', () => {
    const skills = [makeSkill()];
    const scores = computeSkillScores(skills, []);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.score).toBe(100);
  });

  it('reduces score for errors', () => {
    const skills = [makeSkill()];
    const diagnostics: Diagnostic[] = [
      {
        ruleId: 'frontmatter.required',
        severity: 'error',
        message: 'test',
        file: 'skills/my-skill/SKILL.md',
        line: 1,
        column: 1,
      },
    ];
    const scores = computeSkillScores(skills, diagnostics);
    expect(scores[0]?.score).toBeLessThan(100);
    expect(scores[0]?.breakdown.frontmatter).toBe(0);
  });

  it('reduces score less for warnings', () => {
    const skills = [makeSkill()];
    const errDiags: Diagnostic[] = [
      {
        ruleId: 'frontmatter.required',
        severity: 'error',
        message: 'test',
        file: 'skills/my-skill/SKILL.md',
        line: 1,
        column: 1,
      },
    ];
    const warnDiags: Diagnostic[] = [
      {
        ruleId: 'frontmatter.required',
        severity: 'warn',
        message: 'test',
        file: 'skills/my-skill/SKILL.md',
        line: 1,
        column: 1,
      },
    ];
    const errScores = computeSkillScores(skills, errDiags);
    const warnScores = computeSkillScores(skills, warnDiags);
    expect(warnScores[0]?.score).toBeGreaterThan(errScores[0]?.score);
  });

  it('handles multiple skills independently', () => {
    const skills = [
      makeSkill({ relativePath: 'a.md' }),
      makeSkill({ relativePath: 'b.md' }),
    ];
    const diagnostics: Diagnostic[] = [
      {
        ruleId: 'body.max_lines',
        severity: 'error',
        message: 'test',
        file: 'a.md',
        line: 1,
        column: 1,
      },
    ];
    const scores = computeSkillScores(skills, diagnostics);
    expect(scores[0]?.score).toBeLessThan(100);
    expect(scores[1]?.score).toBe(100);
  });

  it('categorizes link rules correctly', () => {
    const skills = [makeSkill()];
    const diagnostics: Diagnostic[] = [
      {
        ruleId: 'links.local_markdown_resolves',
        severity: 'error',
        message: 'test',
        file: 'skills/my-skill/SKILL.md',
        line: 1,
        column: 1,
      },
    ];
    const scores = computeSkillScores(skills, diagnostics);
    expect(scores[0]?.breakdown.links).toBe(0);
    expect(scores[0]?.breakdown.frontmatter).toBe(30);
  });

  it('never returns score below 0', () => {
    const skills = [makeSkill()];
    const diagnostics: Diagnostic[] = Array.from({ length: 20 }, (_, i) => ({
      ruleId: `frontmatter.rule${i}`,
      severity: 'error' as const,
      message: 'test',
      file: 'skills/my-skill/SKILL.md',
      line: 1,
      column: 1,
    }));
    const scores = computeSkillScores(skills, diagnostics);
    expect(scores[0]?.score).toBeGreaterThanOrEqual(0);
  });
});
