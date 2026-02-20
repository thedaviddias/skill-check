import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';
import { discoverSkillFiles } from '../../src/core/discovery.js';

describe('discoverSkillFiles', () => {
  it('finds skill files when target path is a skills directory', async () => {
    const cwd = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-discovery-'),
    );
    const skillFile = path.join(cwd, '.claude/skills/demo-skill/SKILL.md');

    fs.mkdirSync(path.dirname(skillFile), { recursive: true });
    fs.writeFileSync(
      skillFile,
      [
        '---',
        'name: demo-skill',
        'description: Use when validating direct skills-directory discovery.',
        '---',
        '',
      ].join('\n'),
    );

    const config = await resolveConfig(
      cwd,
      path.join(cwd, '.claude/skills'),
      {},
    );
    const files = await discoverSkillFiles(config);

    expect(files).toEqual([path.resolve(skillFile)]);
  });
});
