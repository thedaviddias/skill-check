import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';

describe('resolveConfig additional branches', () => {
  it('reads config from a JSON file when provided', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cfg-'));
    const configPath = path.join(tempDir, 'skill-check.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        roots: ['src'],
        limits: { maxBodyLines: 999 },
        rules: { 'body.max_lines': 'warn' },
        output: { format: 'json' },
      }),
    );
    const config = await resolveConfig(tempDir, '.', {
      configPath,
    });
    expect(config.limits.maxBodyLines).toBe(999);
    expect(config.rules['body.max_lines']).toBe('warn');
    expect(config.output.format).toBe('json');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws for invalid format in config file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cfg-'));
    const configPath = path.join(tempDir, 'bad.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ output: { format: 'invalid' } }),
    );
    await expect(resolveConfig(tempDir, '.', { configPath })).rejects.toThrow(
      'output.format',
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('applies strict mode', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-strict-'));
    const config = await resolveConfig(tempDir, '.', { strict: true });
    expect(config.strictMode).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('applies exclude from CLI', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-excl-'));
    const config = await resolveConfig(tempDir, '.', {
      exclude: ['**/vendor/**'],
    });
    expect(config.exclude).toContain('**/vendor/**');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves with html format', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-html-'));
    const config = await resolveConfig(tempDir, '.', { format: 'html' });
    expect(config.output.format).toBe('html');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves with github format', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-gh-'));
    const config = await resolveConfig(tempDir, '.', { format: 'github' });
    expect(config.output.format).toBe('github');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses allowlist from config file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-allow-'));
    const configPath = path.join(tempDir, 'cfg.json');
    fs.writeFileSync(configPath, JSON.stringify({ allowlist: ['legacy/*'] }));
    const config = await resolveConfig(tempDir, '.', { configPath });
    expect(config.allowlist).toContain('legacy/*');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws for missing config path', async () => {
    await expect(
      resolveConfig('/tmp', '.', { configPath: '/does/not/exist.json' }),
    ).rejects.toThrow('Config file not found');
  });
});
