import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveAgentScanSkillRoots,
  isValidAgentScanRunner,
  resolveAgentScanInvocation,
  summarizeAgentScanOutput,
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

  it('derives skills roots from discovered SKILL.md files', () => {
    const roots = deriveAgentScanSkillRoots([
      '/tmp/repo/.agents/skills/my-skill/SKILL.md',
      '/tmp/repo/.agents/skills/other-skill/SKILL.md',
      '/tmp/repo/global/skills/x/SKILL.md',
    ]);

    expect(roots).toEqual([
      '/tmp/repo/.agents/skills',
      '/tmp/repo/global/skills',
    ]);
  });

  it('falls back to skill directory when parent is not named skills', () => {
    const roots = deriveAgentScanSkillRoots([
      '/tmp/repo/custom/my-skill/SKILL.md',
    ]);

    expect(roots).toEqual(['/tmp/repo/custom/my-skill']);
  });

  it('orders inferred roots by discovered skill count (highest first)', () => {
    const roots = deriveAgentScanSkillRoots([
      '/tmp/repo/docs/skills/a/SKILL.md',
      '/tmp/repo/.agents/skills/a/SKILL.md',
      '/tmp/repo/.agents/skills/b/SKILL.md',
      '/tmp/repo/.agents/skills/c/SKILL.md',
    ]);

    expect(roots[0]).toBe('/tmp/repo/.agents/skills');
    expect(roots[1]).toBe('/tmp/repo/docs/skills');
  });

  it('summarizes scanner output findings and scan target', () => {
    const summary = summarizeAgentScanOutput(`
Invariant MCP-scan v0.4.2
● Scanning /tmp/repo/.agents/skills found 6 skills
│
├── demo
│   ● [W007]: Insecure credential handling detected
└── other
    ● [W011]: Third-party content exposure detected
`);

    expect(summary.scannedTarget).toBe('/tmp/repo/.agents/skills');
    expect(summary.skillsFound).toBe(6);
    expect(summary.findingsTotal).toBe(2);
    expect(summary.findingsByCode).toEqual({
      W007: 1,
      W011: 1,
    });
    expect(summary.noSkillsOrServers).toBe(false);
  });

  it('detects scanner no-skills message', () => {
    const summary = summarizeAgentScanOutput(
      '● Scanning /tmp/repo no servers or skills found',
    );

    expect(summary.noSkillsOrServers).toBe(true);
    expect(summary.findingsTotal).toBe(0);
  });
});
