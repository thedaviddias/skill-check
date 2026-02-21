import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('CLI remote URL targets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('materializes a GitHub URL for check command', async () => {
    const remoteUrl = 'https://github.com/acme/repo';
    const cleanup = vi.fn();
    const materializeRemoteTarget = vi.fn(
      (
        _input: string,
        deps?: { onProgress?: (event: Record<string, unknown>) => void },
      ) => {
        deps?.onProgress?.({
          type: 'clone_start',
          cloneUrl: 'https://github.com/acme/repo.git',
        });
        deps?.onProgress?.({
          type: 'clone_done',
          checkoutPath: '/tmp/remote-1/repo',
        });
        deps?.onProgress?.({
          type: 'ready',
          targetPath: path.join(fixturesRoot, 'pass/basic'),
        });
        return {
          path: path.join(fixturesRoot, 'pass/basic'),
          cleanup,
          metadata: {
            originalUrl: remoteUrl,
            owner: 'acme',
            repo: 'repo',
            cloneUrl: 'https://github.com/acme/repo.git',
            tempDir: '/tmp/remote-1',
            checkoutPath: '/tmp/remote-1/repo',
          },
        };
      },
    );

    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stdout, stderr } = createIO();
    const code = await runCli(['check', remoteUrl, '--no-security-scan'], io);

    expect(code).toBe(0);
    expect(materializeRemoteTarget).toHaveBeenCalledWith(
      remoteUrl,
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('run: npx skill-check check');
    expect(output).toContain(
      `npx skill-check check ${remoteUrl} --no-security-scan`,
    );
    const err = stripAnsi(stderr.join(''));
    expect(err).toContain('[remote] Preparing remote target:');
    expect(err).toContain('[remote] Cloning https://github.com/acme/repo.git');
    expect(err).toContain('[remote] Remote target ready:');
  });

  it('rejects --fix for GitHub URL targets', async () => {
    const materializeRemoteTarget = vi.fn(() => ({
      path: path.join(fixturesRoot, 'pass/basic'),
      cleanup: vi.fn(),
      metadata: {
        originalUrl: 'https://github.com/acme/repo',
        owner: 'acme',
        repo: 'repo',
        cloneUrl: 'https://github.com/acme/repo.git',
        tempDir: '/tmp/remote-2',
        checkoutPath: '/tmp/remote-2/repo',
      },
    }));

    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stderr } = createIO();
    const code = await runCli(
      ['check', 'https://github.com/acme/repo', '--fix', '--no-security-scan'],
      io,
    );

    expect(code).toBe(2);
    expect(stderr.join('')).toContain('Cannot use --fix with a GitHub URL');
    expect(materializeRemoteTarget).not.toHaveBeenCalled();
  });

  it('rejects watch with a GitHub URL target', async () => {
    const materializeRemoteTarget = vi.fn();
    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stderr } = createIO();
    const code = await runCli(['watch', 'https://github.com/acme/repo'], io);

    expect(code).toBe(2);
    expect(stderr.join('')).toContain(
      'watch does not support GitHub URL targets yet',
    );
    expect(materializeRemoteTarget).not.toHaveBeenCalled();
  });

  it('rejects diff when one argument is a GitHub URL', async () => {
    const materializeRemoteTarget = vi.fn();
    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stderr } = createIO();
    const code = await runCli(
      [
        'diff',
        'https://github.com/acme/repo',
        path.join(fixturesRoot, 'pass/basic'),
      ],
      io,
    );

    expect(code).toBe(2);
    expect(stderr.join('')).toContain(
      'diff does not support GitHub URL targets yet',
    );
    expect(materializeRemoteTarget).not.toHaveBeenCalled();
  });

  it('keeps local-path checks unchanged', async () => {
    const materializeRemoteTarget = vi.fn();
    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (_value: string) => false,
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io } = createIO();
    const code = await runCli(
      ['check', path.join(fixturesRoot, 'pass/basic'), '--no-security-scan'],
      io,
    );

    expect(code).toBe(0);
    expect(materializeRemoteTarget).not.toHaveBeenCalled();
  });

  it('prints full command below the card when GitHub URL command is long', async () => {
    const longUrl =
      'https://github.com/acme/repo/tree/main/this/is/a/very/long/path/with/many/segments/for/shareability/testing';
    const cleanup = vi.fn();
    const materializeRemoteTarget = vi.fn(() => ({
      path: path.join(fixturesRoot, 'pass/basic'),
      cleanup,
      metadata: {
        originalUrl: longUrl,
        owner: 'acme',
        repo: 'repo',
        cloneUrl: 'https://github.com/acme/repo.git',
        tempDir: '/tmp/remote-3',
        checkoutPath: '/tmp/remote-3/repo',
      },
    }));

    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stdout } = createIO();
    const code = await runCli(['check', longUrl, '--no-security-scan'], io);

    expect(code).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(1);

    const output = stripAnsi(stdout.join(''));
    const fullCommand = `npx skill-check check ${longUrl} --no-security-scan`;
    expect(output).toContain('full command below');
    expect(output).toContain(fullCommand);
    expect(output).toContain('…');
  });

  it('keeps json stdout parseable and writes remote loader to stderr', async () => {
    const remoteUrl = 'https://github.com/acme/repo';
    const cleanup = vi.fn();
    const materializeRemoteTarget = vi.fn(
      (
        _input: string,
        deps?: { onProgress?: (event: Record<string, unknown>) => void },
      ) => {
        deps?.onProgress?.({
          type: 'clone_start',
          cloneUrl: 'https://github.com/acme/repo.git',
        });
        deps?.onProgress?.({
          type: 'ready',
          targetPath: path.join(fixturesRoot, 'pass/basic'),
        });
        return {
          path: path.join(fixturesRoot, 'pass/basic'),
          cleanup,
          metadata: {
            originalUrl: remoteUrl,
            owner: 'acme',
            repo: 'repo',
            cloneUrl: 'https://github.com/acme/repo.git',
            tempDir: '/tmp/remote-json',
            checkoutPath: '/tmp/remote-json/repo',
          },
        };
      },
    );

    vi.doMock('../../src/core/remote-target.js', () => ({
      isGitHubRepoUrl: (value: string) =>
        value.startsWith('https://github.com/'),
      materializeRemoteTarget,
    }));

    const { runCli } = await import('../../src/cli/main.js');
    const { io, stdout, stderr } = createIO();
    const code = await runCli(
      ['check', remoteUrl, '--format', 'json', '--no-security-scan'],
      io,
    );

    expect(code).toBe(0);
    expect(() => JSON.parse(stdout.join(''))).not.toThrow();
    const err = stripAnsi(stderr.join(''));
    expect(err).toContain('[remote] Preparing remote target:');
    expect(err).toContain('[remote] Cloning https://github.com/acme/repo.git');
    expect(err).toContain('[remote] Remote target ready:');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
