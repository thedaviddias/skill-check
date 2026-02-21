import { describe, expect, it } from 'vitest';
import { normalizeRootCommandArgs } from '../../src/cli/main.js';

describe('normalizeRootCommandArgs', () => {
  it('defaults empty argv to check current directory', () => {
    expect(normalizeRootCommandArgs([])).toEqual(['check', '.']);
  });

  it('keeps explicit root commands unchanged', () => {
    expect(normalizeRootCommandArgs(['check', '.'])).toEqual(['check', '.']);
    expect(normalizeRootCommandArgs(['report', '.'])).toEqual(['report', '.']);
  });

  it('keeps help option unchanged', () => {
    expect(normalizeRootCommandArgs(['--help'])).toEqual(['--help']);
  });

  it('routes option-first invocations to check current directory', () => {
    expect(normalizeRootCommandArgs(['--share'])).toEqual([
      'check',
      '.',
      '--share',
    ]);
    expect(normalizeRootCommandArgs(['--no-security-scan'])).toEqual([
      'check',
      '.',
      '--no-security-scan',
    ]);
  });

  it('normalizes shorthand targets to check command', () => {
    expect(normalizeRootCommandArgs(['fixtures/pass/basic'])).toEqual([
      'check',
      'fixtures/pass/basic',
    ]);
  });
});
