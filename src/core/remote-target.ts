import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliError } from './errors.js';

export interface ParsedGitHubTarget {
  originalUrl: string;
  owner: string;
  repo: string;
  cloneUrl: string;
  ref?: string;
  subpath?: string;
}

export interface MaterializedRemoteTarget {
  path: string;
  cleanup: () => void;
  metadata: ParsedGitHubTarget & {
    tempDir: string;
    checkoutPath: string;
  };
}

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}

type CommandRunner = (
  command: string,
  args: string[],
  cwd?: string,
) => CommandResult;

interface MaterializeDeps {
  runCommand?: CommandRunner;
  mkdtempSync?: (prefix: string) => string;
  removeDir?: (target: string) => void;
  pathExists?: (target: string) => boolean;
}

function decodePathPart(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new CliError(`Invalid GitHub URL: unable to decode ${label}.`, 2);
  }
}

function parseAsUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function defaultRunCommand(
  command: string,
  args: string[],
  cwd?: string,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error as NodeJS.ErrnoException | undefined,
  };
}

function ensureWithinCheckout(baseDir: string, candidatePath: string): void {
  const relative = path.relative(baseDir, candidatePath);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative === ''
  ) {
    throw new CliError(
      'Invalid GitHub tree subpath: resolved path escapes repository root.',
      2,
    );
  }
}

function trimErrorText(text: string): string {
  return text.trim().split('\n').slice(0, 3).join(' ').trim();
}

export function isGitHubRepoUrl(input: string): boolean {
  const url = parseAsUrl(input);
  if (!url) return false;
  if (url.hostname.toLowerCase() !== 'github.com') return false;

  const segments = url.pathname.split('/').filter(Boolean);
  return segments.length >= 2;
}

export function parseGitHubTarget(input: string): ParsedGitHubTarget {
  const url = parseAsUrl(input);
  if (!url) {
    throw new CliError(`Invalid GitHub URL: "${input}".`, 2);
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'github.com') {
    throw new CliError(
      `Unsupported URL host "${url.hostname}". Only github.com is supported.`,
      2,
    );
  }

  if (url.search || url.hash) {
    throw new CliError(
      'GitHub URL targets must not include query params or hash fragments.',
      2,
    );
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new CliError(
      'Invalid GitHub URL: expected https://github.com/<owner>/<repo>.',
      2,
    );
  }

  const owner = decodePathPart(segments[0], 'owner');
  const repoRaw = decodePathPart(segments[1], 'repo');
  const repo = repoRaw.endsWith('.git') ? repoRaw.slice(0, -4) : repoRaw;
  if (!owner || !repo) {
    throw new CliError(
      'Invalid GitHub URL: owner and repo must be non-empty.',
      2,
    );
  }

  let ref: string | undefined;
  let subpath: string | undefined;
  if (segments.length > 2) {
    if (segments[2] !== 'tree') {
      throw new CliError(
        'Unsupported GitHub URL path. Use repo root or /tree/<ref>/<subpath>.',
        2,
      );
    }
    if (segments.length < 4) {
      throw new CliError(
        'Invalid GitHub tree URL: missing <ref> segment after /tree/.',
        2,
      );
    }
    ref = decodePathPart(segments[3], 'ref');
    if (!ref) {
      throw new CliError('Invalid GitHub tree URL: <ref> cannot be empty.', 2);
    }

    if (segments.length > 4) {
      subpath = segments
        .slice(4)
        .map((segment, index) =>
          decodePathPart(segment, `tree subpath segment ${index + 1}`),
        )
        .join('/');
    }
  }

  return {
    originalUrl: input,
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    ref,
    subpath,
  };
}

export function materializeRemoteTarget(
  input: string,
  deps: MaterializeDeps = {},
): MaterializedRemoteTarget {
  const parsed = parseGitHubTarget(input);
  const mkdtempSync =
    deps.mkdtempSync ?? ((prefix: string) => fs.mkdtempSync(prefix));
  const removeDir =
    deps.removeDir ??
    ((target: string) => fs.rmSync(target, { recursive: true, force: true }));
  const pathExists =
    deps.pathExists ?? ((target: string) => fs.existsSync(target));
  const runCommand = deps.runCommand ?? defaultRunCommand;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'skill-check-remote-'));
  const checkoutPath = path.join(tempDir, 'repo');
  const cleanup = (): void => {
    removeDir(tempDir);
  };

  try {
    const cloneArgs = ['clone', '--depth', '1'];
    if (parsed.ref) {
      cloneArgs.push('--branch', parsed.ref, '--single-branch');
    }
    cloneArgs.push(parsed.cloneUrl, checkoutPath);

    const result = runCommand('git', cloneArgs);
    if (result.error?.code === 'ENOENT') {
      throw new CliError(
        'git is required to scan GitHub URL targets but was not found in PATH.',
        2,
      );
    }
    if (result.error) {
      throw new CliError(
        `Failed to clone GitHub URL target: ${result.error.message}`,
        2,
      );
    }
    if (result.status !== 0) {
      const details = trimErrorText(result.stderr || result.stdout);
      throw new CliError(
        `git clone failed for ${parsed.cloneUrl}${details ? `: ${details}` : ''}`,
        2,
      );
    }

    if (!pathExists(checkoutPath)) {
      throw new CliError(
        'Remote checkout did not produce a repository directory.',
        2,
      );
    }

    let targetPath = checkoutPath;
    if (parsed.subpath) {
      const resolvedSubpath = path.resolve(checkoutPath, parsed.subpath);
      ensureWithinCheckout(checkoutPath, resolvedSubpath);
      if (!pathExists(resolvedSubpath)) {
        throw new CliError(
          `GitHub tree subpath not found in checkout: ${parsed.subpath}`,
          2,
        );
      }
      targetPath = resolvedSubpath;
    }

    return {
      path: targetPath,
      cleanup,
      metadata: {
        ...parsed,
        tempDir,
        checkoutPath,
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
