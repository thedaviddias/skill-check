import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isGitHubRepoUrl,
  materializeRemoteTarget,
  parseGitHubTarget,
} from '../../src/core/remote-target.js';

describe('remote target parsing', () => {
  it('recognizes github repo URLs', () => {
    expect(isGitHubRepoUrl('https://github.com/acme/repo')).toBe(true);
    expect(
      isGitHubRepoUrl('https://github.com/acme/repo/tree/main/skills/demo'),
    ).toBe(true);
    expect(isGitHubRepoUrl('https://gitlab.com/acme/repo')).toBe(false);
    expect(isGitHubRepoUrl('not-a-url')).toBe(false);
  });

  it('parses root repository URL', () => {
    const parsed = parseGitHubTarget('https://github.com/acme/repo');
    expect(parsed.owner).toBe('acme');
    expect(parsed.repo).toBe('repo');
    expect(parsed.cloneUrl).toBe('https://github.com/acme/repo.git');
    expect(parsed.ref).toBeUndefined();
    expect(parsed.subpath).toBeUndefined();
  });

  it('parses .git suffix and tree subpath', () => {
    const parsed = parseGitHubTarget(
      'https://github.com/acme/repo.git/tree/main/skills/demo/',
    );
    expect(parsed.repo).toBe('repo');
    expect(parsed.ref).toBe('main');
    expect(parsed.subpath).toBe('skills/demo');
  });

  it('rejects unsupported github URL paths', () => {
    expect(() =>
      parseGitHubTarget('https://github.com/acme/repo/blob/main/README.md'),
    ).toThrow('Unsupported GitHub URL path');
  });

  it('rejects tree URLs missing ref', () => {
    expect(() =>
      parseGitHubTarget('https://github.com/acme/repo/tree'),
    ).toThrow('missing <ref>');
  });
});

describe('remote target materialization', () => {
  it('materializes root repo URL with shallow clone', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const materialized = materializeRemoteTarget(
      'https://github.com/acme/repo',
      {
        runCommand: (command, args) => {
          calls.push({ command, args });
          const checkout = args[args.length - 1];
          fs.mkdirSync(checkout, { recursive: true });
          return {
            status: 0,
            stdout: '',
            stderr: '',
          };
        },
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe('git');
    expect(calls[0]?.args.slice(0, 3)).toEqual(['clone', '--depth', '1']);
    expect(calls[0]?.args[calls[0].args.length - 2]).toBe(
      'https://github.com/acme/repo.git',
    );
    expect(materialized.path).toBe(materialized.metadata.checkoutPath);
    expect(fs.existsSync(materialized.metadata.tempDir)).toBe(true);

    materialized.cleanup();
    expect(fs.existsSync(materialized.metadata.tempDir)).toBe(false);
  });

  it('materializes tree URL with branch and subpath', () => {
    const materialized = materializeRemoteTarget(
      'https://github.com/acme/repo/tree/main/skills/demo',
      {
        runCommand: (_command, args) => {
          const checkout = args[args.length - 1];
          fs.mkdirSync(path.join(checkout, 'skills/demo'), { recursive: true });
          return {
            status: 0,
            stdout: '',
            stderr: '',
          };
        },
      },
    );

    expect(materialized.metadata.ref).toBe('main');
    expect(materialized.metadata.subpath).toBe('skills/demo');
    expect(
      materialized.path.endsWith(path.join('repo', 'skills', 'demo')),
    ).toBe(true);

    materialized.cleanup();
  });

  it('cleans up temp dir when git clone fails', () => {
    const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-remote-fail-'));
    let createdTempDir: string | undefined;

    expect(() =>
      materializeRemoteTarget('https://github.com/acme/repo', {
        mkdtempSync: () => {
          createdTempDir = fs.mkdtempSync(path.join(tmpParent, 'checkout-'));
          return createdTempDir;
        },
        runCommand: () => ({
          status: 128,
          stdout: '',
          stderr: 'fatal: repository not found',
        }),
      }),
    ).toThrow('git clone failed');

    expect(createdTempDir).toBeTruthy();
    if (createdTempDir) {
      expect(fs.existsSync(createdTempDir)).toBe(false);
    }

    fs.rmSync(tmpParent, { recursive: true, force: true });
  });

  it('rejects missing tree subpath after clone', () => {
    expect(() =>
      materializeRemoteTarget(
        'https://github.com/acme/repo/tree/main/skills/x',
        {
          runCommand: (_command, args) => {
            const checkout = args[args.length - 1];
            fs.mkdirSync(checkout, { recursive: true });
            return {
              status: 0,
              stdout: '',
              stderr: '',
            };
          },
        },
      ),
    ).toThrow('GitHub tree subpath not found');
  });
});
