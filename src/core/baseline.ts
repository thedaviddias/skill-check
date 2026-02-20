import fs from 'node:fs';
import type { Diagnostic } from '../types.js';

interface BaselineData {
  diagnostics: Diagnostic[];
}

function diagnosticKey(d: Diagnostic): string {
  return `${d.file}|${d.ruleId}|${d.line}|${d.column}|${d.message}`;
}

export function loadBaseline(baselinePath: string): Diagnostic[] {
  const raw = fs.readFileSync(baselinePath, 'utf8');
  const data = JSON.parse(raw) as BaselineData;
  return data.diagnostics ?? [];
}

export interface BaselineDiff {
  newDiagnostics: Diagnostic[];
  fixedDiagnostics: Diagnostic[];
  unchanged: Diagnostic[];
}

export function diffBaseline(
  current: Diagnostic[],
  baseline: Diagnostic[],
): BaselineDiff {
  const baselineKeys = new Set(baseline.map(diagnosticKey));
  const currentKeys = new Set(current.map(diagnosticKey));

  const newDiagnostics = current.filter(
    (d) => !baselineKeys.has(diagnosticKey(d)),
  );
  const fixedDiagnostics = baseline.filter(
    (d) => !currentKeys.has(diagnosticKey(d)),
  );
  const unchanged = current.filter((d) => baselineKeys.has(diagnosticKey(d)));

  return { newDiagnostics, fixedDiagnostics, unchanged };
}
