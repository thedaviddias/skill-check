import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diffBaseline, loadBaseline } from '../../src/core/baseline.js';
import type { Diagnostic } from '../../src/types.js';

const tempDir = os.tmpdir();

function makeDiag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    ruleId: 'test.rule',
    severity: 'error',
    message: 'test message',
    file: 'test.md',
    line: 1,
    column: 1,
    ...overrides,
  };
}

describe('loadBaseline', () => {
  const tempFile = path.join(tempDir, `baseline-test-${Date.now()}.json`);

  afterEach(() => {
    try {
      fs.unlinkSync(tempFile);
    } catch {}
  });

  it('loads diagnostics from a JSON file', () => {
    const diagnostics = [makeDiag()];
    fs.writeFileSync(tempFile, JSON.stringify({ diagnostics }));
    const loaded = loadBaseline(tempFile);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.ruleId).toBe('test.rule');
  });

  it('returns empty array when diagnostics key is missing', () => {
    fs.writeFileSync(tempFile, JSON.stringify({}));
    const loaded = loadBaseline(tempFile);
    expect(loaded).toHaveLength(0);
  });
});

describe('diffBaseline', () => {
  it('identifies new diagnostics', () => {
    const current = [makeDiag({ ruleId: 'a' }), makeDiag({ ruleId: 'b' })];
    const baseline = [makeDiag({ ruleId: 'a' })];
    const diff = diffBaseline(current, baseline);
    expect(diff.newDiagnostics).toHaveLength(1);
    expect(diff.newDiagnostics[0]?.ruleId).toBe('b');
    expect(diff.fixedDiagnostics).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
  });

  it('identifies fixed diagnostics', () => {
    const current = [makeDiag({ ruleId: 'a' })];
    const baseline = [makeDiag({ ruleId: 'a' }), makeDiag({ ruleId: 'c' })];
    const diff = diffBaseline(current, baseline);
    expect(diff.fixedDiagnostics).toHaveLength(1);
    expect(diff.fixedDiagnostics[0]?.ruleId).toBe('c');
    expect(diff.newDiagnostics).toHaveLength(0);
  });

  it('handles identical sets', () => {
    const diags = [makeDiag()];
    const diff = diffBaseline(diags, diags);
    expect(diff.newDiagnostics).toHaveLength(0);
    expect(diff.fixedDiagnostics).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
  });

  it('handles empty sets', () => {
    const diff = diffBaseline([], []);
    expect(diff.newDiagnostics).toHaveLength(0);
    expect(diff.fixedDiagnostics).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });
});
