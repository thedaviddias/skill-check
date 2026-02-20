import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli/main.js';

const fixturesRoot = path.resolve('fixtures');

function createIO() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
    stdout,
    stderr,
  };
}

describe('skill-check new', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-new-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scaffolds a new skill directory', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(['new', 'test-skill', '--dir', tempDir], io);
    expect(code).toBe(0);
    expect(stdout.join('')).toContain('Created');
    const skillPath = path.join(tempDir, 'test-skill', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const content = fs.readFileSync(skillPath, 'utf8');
    expect(content).toContain('name: test-skill');
    expect(content).toContain('Use when');
  });

  it('slugifies the name', async () => {
    const { io } = createIO();
    const code = await runCli(['new', 'My Cool Skill', '--dir', tempDir], io);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, 'my-cool-skill', 'SKILL.md'))).toBe(
      true,
    );
  });

  it('fails if directory already exists', async () => {
    fs.mkdirSync(path.join(tempDir, 'existing'));
    const { io, stderr } = createIO();
    const code = await runCli(['new', 'existing', '--dir', tempDir], io);
    expect(code).toBe(1);
    expect(stderr.join('')).toContain('already exists');
  });
});

describe('skill-check rules', () => {
  it('lists all rules with fixable badge', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(['rules'], io);
    expect(code).toBe(0);
    const output = stdout.join('');
    expect(output).toContain('frontmatter.required');
    expect(output).toContain('body.max_tokens');
    expect(output).toContain('[fixable]');
  });

  it('shows detail for a specific rule', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(['rules', 'body.max_tokens'], io);
    expect(code).toBe(0);
    const output = stdout.join('');
    expect(output).toContain('body.max_tokens');
    expect(output).toContain('Severity');
    expect(output).toContain('Fixable');
  });

  it('reports unknown rule', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(['rules', 'nonexistent.rule'], io);
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Unknown rule');
  });
});

describe('skill-check diff', () => {
  it('compares two directories', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'diff',
        path.join(fixturesRoot, 'pass/basic'),
        path.join(fixturesRoot, 'fail/multi-mixed'),
      ],
      io,
    );
    expect(code).toBe(0);
    const output = stdout.join('');
    expect(output).toContain('Diff:');
    expect(output).toContain('diagnostic(s)');
  });
});

describe('skill-check check --format github', () => {
  it('emits github annotations for failing fixture', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/multi-mixed'),
        '--format',
        'github',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(1);
    const output = stdout.join('');
    expect(output).toContain('::error');
    expect(output).toContain('frontmatter');
  });

  it('emits nothing for passing fixture', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--format',
        'github',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(0);
    const output = stdout.join('');
    expect(output).not.toContain('::error');
  });
});

describe('skill-check check --format html', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-html-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes an HTML report file', async () => {
    const reportPath = path.join(tempDir, 'report.html');
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ output: { format: 'html', reportPath } }),
    );

    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--config',
        configPath,
        '--no-open',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(0);
    expect(stdout.join('')).toContain('Wrote');
    expect(fs.existsSync(reportPath)).toBe(true);
    const html = fs.readFileSync(reportPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Quality Scores');
  });
});

describe('skill-check check --baseline', () => {
  it('shows baseline diff when baseline file provided', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-base-'));
    const baselinePath = path.join(tempDir, 'baseline.json');

    const { io: jsonIo, stdout: jsonOut } = createIO();
    await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/multi-mixed'),
        '--format',
        'json',
        '--no-security-scan',
      ],
      jsonIo,
    );
    fs.writeFileSync(baselinePath, jsonOut.join(''));

    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/multi-mixed'),
        '--baseline',
        baselinePath,
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(1);
    const output = stdout.join('');
    expect(output).toContain('Baseline:');
    expect(output).toContain('unchanged');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('skill-check check --format json includes scores', () => {
  it('includes scores array in json output', async () => {
    const { io, stdout } = createIO();
    await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--format',
        'json',
        '--no-security-scan',
      ],
      io,
    );
    const parsed = JSON.parse(stdout.join('')) as Record<string, unknown>;
    expect(Array.isArray(parsed.scores)).toBe(true);
  });
});
