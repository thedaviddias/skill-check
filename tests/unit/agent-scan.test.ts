import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isValidAgentScanRunner,
  resolveAgentScanInvocation,
} from '../../src/core/agent-scan.js';

describe('security scan integration', () => {
  it('accepts supported runners', () => {
    expect(isValidAgentScanRunner('auto')).toBe(true);
    expect(isValidAgentScanRunner('local')).toBe(true);
    expect(isValidAgentScanRunner('uvx')).toBe(true);
    expect(isValidAgentScanRunner('pipx')).toBe(true);
    expect(isValidAgentScanRunner('npx')).toBe(false);
    expect(isValidAgentScanRunner('docker')).toBe(false);
  });

  it('builds uvx invocation', () => {
    const invocation = resolveAgentScanInvocation(
      {
        cwd: '/tmp/repo',
        targetPath: '.claude/skills',
        runner: 'uvx',
      },
      () => false,
    );

    expect(invocation.command).toBe('uvx');
    expect(invocation.args).toEqual([
      'mcp-scan',
      '--skills',
      path.resolve('/tmp/repo/.claude/skills'),
    ]);
  });

  it('builds pipx invocation', () => {
    const invocation = resolveAgentScanInvocation(
      {
        cwd: '/tmp/repo',
        targetPath: '.',
        runner: 'pipx',
        paths: ['src', 'skills'],
        skills: ['.claude/skills'],
      },
      () => false,
    );

    expect(invocation.command).toBe('pipx');
    expect(invocation.args).toEqual([
      'run',
      'mcp-scan',
      path.resolve('/tmp/repo/src'),
      path.resolve('/tmp/repo/skills'),
      '--skills',
      path.resolve('/tmp/repo/.claude/skills'),
    ]);
  });

  it('prefers local command in auto mode', () => {
    const invocation = resolveAgentScanInvocation(
      {
        cwd: '/tmp/repo',
        targetPath: '.',
      },
      (name: string) => name === 'mcp-scan',
    );

    expect(invocation.command).toBe('mcp-scan');
  });
});
