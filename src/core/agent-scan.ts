import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CliError } from './errors.js';

const VALID_RUNNERS = ['auto', 'local', 'uvx', 'pipx'] as const;
export type AgentScanRunner = (typeof VALID_RUNNERS)[number];

export interface AgentScanOptions {
  cwd: string;
  targetPath?: string;
  mode?: string;
  paths?: string[];
  skills?: string[];
  runner?: AgentScanRunner;
}

export interface AgentScanInvocation {
  command: string;
  args: string[];
}

export function deriveAgentScanSkillRoots(skillFilePaths: string[]): string[] {
  const rootCounts = new Map<string, number>();
  for (const skillFilePath of skillFilePaths) {
    const absoluteSkillFilePath = path.resolve(skillFilePath);
    const skillDir = path.dirname(absoluteSkillFilePath);
    const maybeSkillsRoot = path.dirname(skillDir);
    const selectedRoot =
      path.basename(maybeSkillsRoot).toLowerCase() === 'skills'
        ? maybeSkillsRoot
        : skillDir;

    rootCounts.set(selectedRoot, (rootCounts.get(selectedRoot) ?? 0) + 1);
  }

  return Array.from(rootCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([root]) => root);
}

function normalizePaths(
  cwd: string,
  values: string[] | undefined,
  fallback: string[],
): string[] {
  const list = values && values.length > 0 ? values : fallback;
  return list.map((value) => path.resolve(cwd, value));
}

function buildMcpScanArgs(options: AgentScanOptions): string[] {
  const targetPath = options.targetPath ?? '.';
  const paths = normalizePaths(options.cwd, options.paths, []);
  const skills = normalizePaths(options.cwd, options.skills, [targetPath]);

  const args: string[] = [];
  for (const scanPath of paths) {
    args.push(scanPath);
  }
  for (const skillsPath of skills) {
    args.push('--skills', skillsPath);
  }

  return args;
}

export function isValidAgentScanRunner(
  value: string,
): value is AgentScanRunner {
  return VALID_RUNNERS.includes(value as AgentScanRunner);
}

export function isCommandAvailable(commandName: string): boolean {
  const pathValue = process.env.PATH;
  if (!pathValue) return false;

  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
      : [''];

  for (const base of pathValue.split(path.delimiter)) {
    if (!base) continue;
    for (const ext of exts) {
      const candidate = path.join(base, `${commandName}${ext}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch {
        // Try next candidate.
      }
    }
  }

  return false;
}

export function resolveAgentScanInvocation(
  options: AgentScanOptions,
  hasCommand: (commandName: string) => boolean = isCommandAvailable,
): AgentScanInvocation {
  const runner = options.runner ?? 'auto';
  const scanArgs = buildMcpScanArgs(options);

  if (runner === 'local') {
    return { command: 'mcp-scan', args: scanArgs };
  }
  if (runner === 'uvx') {
    return { command: 'uvx', args: ['mcp-scan', ...scanArgs] };
  }
  if (runner === 'pipx') {
    return { command: 'pipx', args: ['run', 'mcp-scan', ...scanArgs] };
  }

  if (hasCommand('mcp-scan')) {
    return { command: 'mcp-scan', args: scanArgs };
  }
  if (hasCommand('uvx')) {
    return { command: 'uvx', args: ['mcp-scan', ...scanArgs] };
  }
  if (hasCommand('pipx')) {
    return { command: 'pipx', args: ['run', 'mcp-scan', ...scanArgs] };
  }

  throw new CliError(
    'No security scan runner found. Install mcp-scan, uv, or pipx.',
    2,
  );
}

export function runAgentScan(options: AgentScanOptions): number {
  const invocation = resolveAgentScanInvocation(options);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
  });

  const error = result.error as NodeJS.ErrnoException | undefined;
  if (error?.code === 'ENOENT') {
    throw new CliError(`Runner not found: ${invocation.command}`, 2);
  }
  if (error) {
    throw new CliError(
      `Failed to run security scan (${invocation.command}): ${error.message}`,
      2,
    );
  }
  if (typeof result.status !== 'number') {
    throw new CliError('Security scan process did not return an exit code.', 2);
  }

  return result.status;
}
