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

function createOversizedSectionedFixture(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-split-'));
  const skillDir = path.join(tempDir, 'global/skills/long-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  const body = [
    '# long-skill',
    '',
    'Use when large instructions should be modularized.',
    '',
    '## Setup',
    'Step 1',
    'Step 2',
    'Step 3',
    '',
    '## Runtime Notes',
    'Note 1',
    'Note 2',
    'Note 3',
    '',
    '## Validation',
    'Check A',
    'Check B',
    'Check C',
    '',
  ].join('\n');

  const content = [
    '---',
    'name: long-skill',
    'description: Use when a large skill body should be split into references docs.',
    '---',
    '',
    body,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  return tempDir;
}

describe('CLI integration', () => {
  beforeEach(() => {
    process.chdir(path.resolve('.'));
  });

  it('returns 0 for valid fixtures', async () => {
    const target = path.join(fixturesRoot, 'pass/basic');
    const { io, stdout } = createIO();
    const code = await runCli(['check', target, '--no-security-scan'], io);
    expect(code).toBe(0);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('run: npx skill-check check');
    expect(output).toContain(
      `npx skill-check check ${target} --no-security-scan`,
    );
  });

  it('supports shorthand path invocation for check', async () => {
    const target = path.join(fixturesRoot, 'pass/basic');
    const { io, stdout } = createIO();
    const code = await runCli([target, '--no-security-scan'], io);
    expect(code).toBe(0);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('run: npx skill-check');
    expect(output).not.toContain('run: npx skill-check check');
    expect(output).toContain(`npx skill-check ${target} --no-security-scan`);
  });

  it('keeps relative local target paths working', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      ['check', 'fixtures/pass/basic', '--no-security-scan'],
      io,
    );
    expect(code).toBe(0);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('1 skill');
    expect(output).toContain('validation PASS');
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

  it('shows split-body preview without writing files', async () => {
    const fixtureDir = createOversizedSectionedFixture();
    const { io, stdout } = createIO();
    const code = await runCli(
      ['split-body', fixtureDir, '--max-body-lines', '10'],
      io,
    );

    expect(code).toBe(0);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('split-body preview');
    expect(output).toContain('[PLAN]');
    expect(output).toContain('would create');
    expect(
      fs.existsSync(
        path.join(fixtureDir, 'global/skills/long-skill/references/setup.md'),
      ),
    ).toBe(false);

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('applies split-body and resolves body.max_lines diagnostics', async () => {
    const fixtureDir = createOversizedSectionedFixture();
    const skillRoot = path.join(fixtureDir, 'global/skills/long-skill');

    const { io: beforeIo, stdout: beforeOut } = createIO();
    const beforeCode = await runCli(
      ['check', fixtureDir, '--max-body-lines', '15', '--no-security-scan'],
      beforeIo,
    );
    expect(beforeCode).toBe(1);
    expect(stripAnsi(beforeOut.join(''))).toContain('body.max_lines');

    const { io: splitIo, stdout: splitOut } = createIO();
    const splitCode = await runCli(
      ['split-body', fixtureDir, '--write', '--max-body-lines', '15'],
      splitIo,
    );
    expect(splitCode).toBe(0);
    const splitOutput = stripAnsi(splitOut.join(''));
    expect(splitOutput).toContain('split-body apply');
    expect(splitOutput).toContain('create (references/setup.md');

    expect(fs.existsSync(path.join(skillRoot, 'references/setup.md'))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(skillRoot, 'references/runtime-notes.md')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(skillRoot, 'references/validation.md')),
    ).toBe(true);
    const rewrittenSkill = fs.readFileSync(
      path.join(skillRoot, 'SKILL.md'),
      'utf8',
    );
    expect(rewrittenSkill).toContain('## References');

    const { io: afterIo, stdout: afterOut } = createIO();
    const afterCode = await runCli(
      ['check', fixtureDir, '--max-body-lines', '15', '--no-security-scan'],
      afterIo,
    );
    expect(afterCode).toBe(0);
    expect(stripAnsi(afterOut.join(''))).not.toContain('body.max_lines');

    const { io: shorthandIo, stdout: shorthandOut } = createIO();
    const shorthandCode = await runCli(
      [fixtureDir, '--max-body-lines', '15', '--no-security-scan'],
      shorthandIo,
    );
    expect(shorthandCode).toBe(0);
    expect(stripAnsi(shorthandOut.join(''))).not.toContain('body.max_lines');

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('returns blocked result for oversized body without H2 sections', async () => {
    const { io, stdout } = createIO();
    const code = await runCli(
      ['split-body', 'fixtures/fail/over-body', '--max-body-lines', '10'],
      io,
    );

    expect(code).toBe(2);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('[BLOCKED]');
    expect(output).toContain('Add at least one ## section heading');
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
    expect(output).toContain('skill-check cli');
    expect(output).toContain('run: npx skill-check check');
    expect(output).toContain('validation FAIL | security SKIPPED');
    expect(output).toContain('✖ 3 errors');
    expect(output).toContain('⚠ 0 warnings');
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

  it('renders social share card with --share', async () => {
    const target = path.join(fixturesRoot, 'pass/basic');
    const shareDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-share-'),
    );
    const sharePath = path.join(shareDir, 'card.png');
    const { io, stdout } = createIO();
    const code = await runCli(
      [
        'check',
        target,
        '--share',
        '--share-out',
        sharePath,
        '--no-security-scan',
      ],
      io,
    );

    expect(code).toBe(0);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('skill-check cli');
    expect(output).toContain('run: npx skill-check check');
    expect(output).toContain('try it: npx skill-check <path-or-github-url>');
    expect(output).toContain('npm: https://www.npmjs.com/package/skill-check');
    expect(output).toContain(`Share image: ${sharePath}`);
    expect(output).not.toContain('SKILL-CHECK VALIDATION REPORT');
    expect(fs.existsSync(sharePath)).toBe(true);
  });

  it('rejects --share with non-text format', async () => {
    const target = path.join(fixturesRoot, 'pass/basic');
    const { io, stderr } = createIO();
    const code = await runCli(
      ['check', target, '--share', '--format', 'json', '--no-security-scan'],
      io,
    );

    expect(code).toBe(2);
    expect(stderr.join('')).toContain('--share requires text output format.');
  });

  it('rejects --share-out without --share', async () => {
    const target = path.join(fixturesRoot, 'pass/basic');
    const { io, stderr } = createIO();
    const code = await runCli(
      ['check', target, '--share-out', '/tmp/card.svg', '--no-security-scan'],
      io,
    );

    expect(code).toBe(2);
    expect(stderr.join('')).toContain('--share-out requires --share.');
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

  it('keeps explicit security-scan command behavior', async () => {
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

  it('keeps help output behavior', async () => {
    const { io, stderr } = createIO();
    const code = await runCli(['--help'], io);
    expect(code).toBe(0);
    expect(stderr.join('')).toBe('');
  });
});
