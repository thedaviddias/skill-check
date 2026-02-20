import type { AnalysisResult } from '../types.js';

export function renderMarkdownReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('# Skill Check Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Skills: ${result.summary.skillCount}`);
  lines.push(`- Errors: ${result.summary.errorCount}`);
  lines.push(`- Warnings: ${result.summary.warningCount}`);
  lines.push('');

  lines.push('## Diagnostics');
  lines.push('');
  lines.push('| File | Severity | Rule | Message |');
  lines.push('| --- | --- | --- | --- |');

  if (result.diagnostics.length === 0) {
    lines.push('| - | - | - | No diagnostics found |');
  } else {
    for (const d of result.diagnostics) {
      lines.push(
        `| ${d.file}:${d.line}:${d.column} | ${d.severity} | ${d.ruleId} | ${d.message} |`,
      );
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
