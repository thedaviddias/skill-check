import type { AnalysisResult } from '../types.js';

export function toGitHubAnnotations(result: AnalysisResult): string {
  const lines: string[] = [];
  for (const d of result.diagnostics) {
    const level = d.severity === 'error' ? 'error' : 'warning';
    const title = d.ruleId;
    const msg = d.suggestion ? `${d.message} (${d.suggestion})` : d.message;
    lines.push(
      `::${level} file=${d.file},line=${d.line},col=${d.column},title=${title}::${msg}`,
    );
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
