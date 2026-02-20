import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';
import { CliError } from '../../src/core/errors.js';

describe('resolveConfig', () => {
  it('applies CLI overrides', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-config-'));
    const config = await resolveConfig(cwd, '.', {
      maxBodyLines: 123,
      maxDescriptionChars: 321,
      include: ['**/custom/**'],
      failOnWarning: true,
    });

    expect(config.limits.maxBodyLines).toBe(123);
    expect(config.limits.maxDescriptionChars).toBe(321);
    expect(config.include).toEqual(['**/custom/**']);
    expect(config.failOnWarning).toBe(true);
  });

  it('disables name match rule in lenient mode', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-lenient-'));
    const config = await resolveConfig(cwd, '.', { lenient: true });
    expect(config.rules['frontmatter.name_matches_directory']).toBe('off');
  });

  it('throws on strict + lenient', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-badopts-'));
    await expect(
      resolveConfig(cwd, '.', { strict: true, lenient: true }),
    ).rejects.toBeInstanceOf(CliError);
  });
});
