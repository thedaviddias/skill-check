import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli/main.js';

const fixturesRoot = path.resolve('fixtures');

const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g');
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

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

function copyFixtureToTemp(relativeFixturePath: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-fix-'));
  const source = path.join(fixturesRoot, relativeFixturePath);
  const destination = path.join(tempDir, 'fixture');
  fs.cpSync(source, destination, { recursive: true });
  return destination;
}

describe('CLI integration', () => {
  beforeEach(() => {
    process.chdir(path.resolve('.'));
  });

  it('returns 0 for valid fixtures', async () => {
    const { io } = createIO();
    const code = await runCli(
      ['check', path.join(fixturesRoot, 'pass/basic'), '--no-security-scan'],
      io,
    );
    expect(code).toBe(0);
  });

  it('returns 0 for valid multi-skill fixtures', async () => {
    const { io } = createIO();
    const code = await runCli(
      ['check', path.join(fixturesRoot, 'pass/multi'), '--no-security-scan'],
      io,
    );
    expect(code).toBe(0);
  });

  it('returns 1 for invalid fixtures', async () => {
    const { io } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/missing-frontmatter'),
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(1);
  });

  it('returns 1 for mixed multi-skill fixtures', async () => {
    const { io } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/multi-mixed'),
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(1);
  });

  it('applies auto-fixes for supported diagnostics with --fix', async () => {
    const fixtureCopy = copyFixtureToTemp('fail/multi-mixed');
    const { io, stdout } = createIO();
    const code = await runCli(
      ['check', fixtureCopy, '--fix', '--no-security-scan'],
      io,
    );
    expect(code).toBe(0);
    expect(stdout.join('')).toContain('Auto-fix:');

    const { io: verifyIo } = createIO();
    const verifyCode = await runCli(
      ['check', fixtureCopy, '--no-security-scan'],
      verifyIo,
    );
    expect(verifyCode).toBe(0);

    const badSkillPath = path.join(
      fixtureCopy,
      'global/skills/fake-bad-skill/SKILL.md',
    );
    const badSlugPath = path.join(
      fixtureCopy,
      'global/skills/fake-bad-slug/SKILL.md',
    );
    const badSkillContent = fs.readFileSync(badSkillPath, 'utf8');
    const badSlugContent = fs.readFileSync(badSlugPath, 'utf8');

    expect(badSkillContent.startsWith('---\n')).toBe(true);
    expect(badSkillContent).toContain('name: fake-bad-skill');
    expect(badSlugContent).toContain('name: fake-bad-slug');
  });

  it('keeps JSON output valid when --fix is enabled', async () => {
    const fixtureCopy = copyFixtureToTemp('fail/bad-slug');
    const { io, stdout } = createIO();
    const code = await runCli(
      ['check', fixtureCopy, '--fix', '--format', 'json', '--no-security-scan'],
      io,
    );

    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join('')) as {
      summary: { errorCount: number };
    };
    expect(parsed.summary.errorCount).toBe(0);
  });

  it('reports remaining diagnostics when --fix cannot resolve all issues', async () => {
    const fixtureCopy = copyFixtureToTemp('fail/over-body');
    const { io, stdout } = createIO();
    const code = await runCli(
      ['check', fixtureCopy, '--fix', '--no-security-scan'],
      io,
    );

    expect(code).toBe(1);
    const output = stdout.join('');
    expect(output).toContain('Auto-fix:');
    expect(output).toContain('unsupported=');
    expect(output).toContain('body.max_lines');
  });

  it('returns 2 for missing config', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(
      [
        'check',
        '.',
        '--config',
        '/tmp/does-not-exist.json',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Config file not found');
  });

  it('emits json output', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--format',
        'json',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join('')) as {
      summary: { errorCount: number };
    };
    expect(parsed.summary.errorCount).toBe(0);
  });

  it('emits json summary for multi-skill fixtures', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/multi'),
        '--format',
        'json',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join('')) as {
      summary: { skillCount: number; errorCount: number; warningCount: number };
    };
    expect(parsed.summary.skillCount).toBe(3);
    expect(parsed.summary.errorCount).toBe(0);
    expect(parsed.summary.warningCount).toBe(0);
  });

  it('emits sarif output', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/broken-link'),
        '--format',
        'sarif',
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join('')) as {
      version: string;
      runs: unknown[];
    };
    expect(parsed.version).toBe('2.1.0');
    expect(Array.isArray(parsed.runs)).toBe(true);
  });

  it('renders real text diagnostics for mixed fixtures', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'fail/multi-mixed'),
        '--no-security-scan',
      ],
      io,
    );
    expect(code).toBe(1);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('VALIDATION REPORT');
    expect(output).toContain('[FILE]');
    expect(output).toContain('fake-bad-skill/SKILL.md');
    expect(output).toContain('frontmatter.required');
    expect(output).toContain('frontmatter.name_slug_format');
    expect(output).toContain('Summary: skills=3 errors=');
    expect(output).toContain('status=');
    expect(output).toContain('Validation:');
    expect(output).toContain('Security scan:');
  });

  it('writes report with reportPath from config', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-report-'),
    );
    const configPath = path.join(tempDir, 'skill-check.config.json');
    const outputPath = path.join(tempDir, 'report.md');

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          output: {
            reportPath: outputPath,
          },
        },
        null,
        2,
      ),
    );

    const { io } = createIO();
    const code = await runCli(
      ['report', path.join(fixturesRoot, 'pass/basic'), '--config', configPath],
      io,
    );
    expect(code).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('returns 2 for invalid security scan runner on check', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--security-scan-runner',
        'invalid-runner',
      ],
      io,
    );
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Invalid --security-scan-runner');
  });

  it('accepts --no-security-scan on check', async () => {
    const { io } = createIO();
    const code = await runCli(
      ['check', path.join(fixturesRoot, 'pass/basic'), '--no-security-scan'],
      io,
    );
    expect(code).toBe(0);
  });

  it('returns 2 for conflicting install policy flags', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(
      [
        'check',
        path.join(fixturesRoot, 'pass/basic'),
        '--allow-installs',
        '--no-installs',
      ],
      io,
    );
    expect(code).toBe(2);
    expect(stderr.join('')).toContain(
      'Cannot use --allow-installs and --no-installs together.',
    );
  });

  it('returns 2 for invalid runner on security-scan command', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(
      ['security-scan', '.', '--security-scan-runner', 'invalid-runner'],
      io,
    );
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Invalid --security-scan-runner');
  });

  it('returns 2 for interactive init in non-interactive environments', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(['init', '--interactive'], io);
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Interactive init requires a TTY');
  });
});
