import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyBodySplitPlan,
  planBodySplit,
  type SplitPlan,
} from '../../src/core/body-split.js';
import type { SkillArtifact } from '../../src/types.js';

function makeSkill(
  body: string,
  overrides: Partial<SkillArtifact> = {},
): SkillArtifact {
  const filePath =
    overrides.filePath ?? '/tmp/test/global/skills/my-skill/SKILL.md';
  return {
    id: 'test/my-skill',
    category: 'test',
    slug: 'my-skill',
    filePath,
    relativePath: 'global/skills/my-skill/SKILL.md',
    content: `---\nname: my-skill\ndescription: Use when splitting body content.\n---\n${body}`,
    body,
    frontmatter: {
      name: 'my-skill',
      description: 'Use when splitting body content.',
    },
    frontmatterRaw:
      'name: my-skill\ndescription: Use when splitting body content.',
    ...overrides,
  };
}

describe('planBodySplit', () => {
  it('splits oversized body into references by H2 sections', () => {
    const body = [
      '# My Skill',
      '',
      'Intro line.',
      '',
      '## Setup',
      'Step 1',
      'Step 2',
      '',
      '## Usage',
      'Use case A',
      'Use case B',
      '',
    ].join('\n');

    const plan = planBodySplit(makeSkill(body), 6);
    expect(plan.status).toBe('planned');
    expect(plan.referencesToCreate).toHaveLength(2);
    expect(plan.referencesToCreate[0]?.relativePath).toBe(
      'references/setup.md',
    );
    expect(plan.referencesToCreate[1]?.relativePath).toBe(
      'references/usage.md',
    );
    expect(plan.newSkillBody).toContain('## References');
    expect(plan.newSkillBody).toContain('[Setup](references/setup.md)');
    expect(plan.newSkillBody).toContain('[Usage](references/usage.md)');
    expect(
      plan.referencesToCreate[0]?.sourceLineRange.startLine,
    ).toBeGreaterThan(1);
  });

  it('resolves slug collisions deterministically', () => {
    const body = ['# My Skill', '', '## API', 'A', '', '## API', 'B', ''].join(
      '\n',
    );

    const plan = planBodySplit(makeSkill(body), 3, {
      pathExists: (targetPath) => targetPath.endsWith(`${path.sep}api.md`),
    });

    expect(plan.status).toBe('planned');
    expect(plan.referencesToCreate.map((entry) => entry.relativePath)).toEqual([
      'references/api-2.md',
      'references/api-3.md',
    ]);
  });

  it('returns blocked when oversized body has no H2 sections', () => {
    const body = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join(
      '\n',
    );
    const plan = planBodySplit(makeSkill(body), 10);
    expect(plan.status).toBe('blocked');
    expect(plan.reason).toContain('Add at least one ## section heading');
  });
});

describe('applyBodySplitPlan', () => {
  it('writes updated skill and reference files', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-split-'),
    );
    const skillDir = path.join(tempDir, 'global/skills/my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, 'SKILL.md');
    const body = [
      '# My Skill',
      '',
      '## Setup',
      'Step 1',
      '',
      '## Usage',
      'Step 2',
    ].join('\n');
    const skill = makeSkill(body, {
      filePath: skillPath,
      relativePath: path.relative(tempDir, skillPath),
      content: `---\nname: my-skill\ndescription: Use when splitting body content.\n---\n${body}`,
    });
    fs.writeFileSync(skillPath, skill.content, 'utf8');

    const plan = planBodySplit(skill, 3);
    expect(plan.status).toBe('planned');

    const result = applyBodySplitPlan(plan as SplitPlan);
    expect(result.updatedSkill).toBe(true);
    expect(result.writtenReferenceFiles.length).toBe(2);
    expect(fs.existsSync(path.join(skillDir, 'references/setup.md'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(skillDir, 'references/usage.md'))).toBe(
      true,
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
