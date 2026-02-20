import { describe, expect, it } from 'vitest';
import { detectDuplicates } from '../../src/core/duplicates.js';
import type { SkillArtifact } from '../../src/types.js';

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

describe('detectDuplicates', () => {
  it('returns empty for unique skills', () => {
    const skills = [
      makeSkill({
        id: 'a',
        relativePath: 'a.md',
        frontmatter: { name: 'skill-a', description: 'Use when a.' },
      }),
      makeSkill({
        id: 'b',
        relativePath: 'b.md',
        frontmatter: { name: 'skill-b', description: 'Use when b.' },
      }),
    ];
    expect(detectDuplicates(skills)).toHaveLength(0);
  });

  it('detects duplicate names', () => {
    const skills = [
      makeSkill({
        id: 'a',
        relativePath: 'a.md',
        frontmatter: { name: 'same-name', description: 'Desc a is unique.' },
      }),
      makeSkill({
        id: 'b',
        relativePath: 'b.md',
        frontmatter: { name: 'same-name', description: 'Desc b is unique.' },
      }),
    ];
    const diags = detectDuplicates(skills);
    const nameWarnings = diags.filter((d) => d.ruleId === 'duplicates.name');
    expect(nameWarnings).toHaveLength(2);
    expect(nameWarnings[0]?.message).toContain('same-name');
  });

  it('detects duplicate descriptions', () => {
    const shared =
      'Use when exactly the same thing happens and this is a long description.';
    const skills = [
      makeSkill({
        id: 'a',
        relativePath: 'a.md',
        frontmatter: { name: 'skill-a', description: shared },
      }),
      makeSkill({
        id: 'b',
        relativePath: 'b.md',
        frontmatter: { name: 'skill-b', description: shared },
      }),
    ];
    const diags = detectDuplicates(skills);
    const descWarnings = diags.filter(
      (d) => d.ruleId === 'duplicates.description',
    );
    expect(descWarnings).toHaveLength(2);
  });

  it('ignores short descriptions for dedup', () => {
    const skills = [
      makeSkill({
        id: 'a',
        relativePath: 'a.md',
        frontmatter: { name: 'a', description: 'short' },
      }),
      makeSkill({
        id: 'b',
        relativePath: 'b.md',
        frontmatter: { name: 'b', description: 'short' },
      }),
    ];
    const diags = detectDuplicates(skills);
    expect(
      diags.filter((d) => d.ruleId === 'duplicates.description'),
    ).toHaveLength(0);
  });

  it('skips skills without frontmatter name', () => {
    const skills = [
      makeSkill({ id: 'a', relativePath: 'a.md', frontmatter: null }),
      makeSkill({
        id: 'b',
        relativePath: 'b.md',
        frontmatter: { name: 'b', description: 'test' },
      }),
    ];
    expect(detectDuplicates(skills)).toHaveLength(0);
  });

  it('skips skills without description', () => {
    const skills = [
      makeSkill({ id: 'a', relativePath: 'a.md', frontmatter: { name: 'a' } }),
      makeSkill({ id: 'b', relativePath: 'b.md', frontmatter: { name: 'b' } }),
    ];
    expect(detectDuplicates(skills)).toHaveLength(0);
  });
});
