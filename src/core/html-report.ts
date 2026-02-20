import type { AnalysisResult, Diagnostic } from '../types.js';
import type { SkillScore } from './quality-score.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = grouped.get(d.file) ?? [];
    list.push(d);
    grouped.set(d.file, list);
  }
  return grouped;
}

function severityClass(severity: Diagnostic['severity']): string {
  return severity === 'error' ? 'severity-error' : 'severity-warn';
}

function statusClass(summary: AnalysisResult['summary']): string {
  if (summary.errorCount > 0) return 'status-fail';
  if (summary.warningCount > 0) return 'status-warn';
  return 'status-pass';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

export function renderHtml(
  result: AnalysisResult,
  scores?: SkillScore[],
): string {
  const grouped = groupByFile(result.diagnostics);
  const sortedFiles = Array.from(grouped.keys()).sort();
  const status = statusClass(result.summary);
  const generated = new Date().toISOString();

  const summarySection = `
    <section class="summary" aria-label="Summary">
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-value">${result.summary.skillCount}</span>
          <span class="summary-label">Skills</span>
        </div>
        <div class="summary-card">
          <span class="summary-value severity-error">${result.summary.errorCount}</span>
          <span class="summary-label">Errors</span>
        </div>
        <div class="summary-card">
          <span class="summary-value severity-warn">${result.summary.warningCount}</span>
          <span class="summary-label">Warnings</span>
        </div>
        <div class="summary-card status-badge ${status}">
          <span class="summary-value">${result.summary.errorCount > 0 ? 'FAIL' : result.summary.warningCount > 0 ? 'WARN' : 'PASS'}</span>
        </div>
      </div>
    </section>`;

  let diagnosticsSection: string;
  if (grouped.size === 0) {
    diagnosticsSection = `
    <section class="diagnostics" aria-label="Diagnostics">
      <p class="no-diagnostics">No diagnostics found.</p>
    </section>`;
  } else {
    const fileSections = sortedFiles
      .map((file) => {
        const diagnostics = grouped.get(file) ?? [];
        const rows = diagnostics
          .map(
            (d) => `
            <tr class="diagnostic-row" data-search="${escapeHtml([d.ruleId, d.message, d.file, d.suggestion ?? ''].join(' ').toLowerCase())}">
              <td class="severity ${severityClass(d.severity)}">${d.severity}</td>
              <td class="rule-id"><code>${escapeHtml(d.ruleId)}</code></td>
              <td class="message">${escapeHtml(d.message)}</td>
              <td class="location">${d.line}:${d.column}</td>
              ${d.suggestion ? `<td class="suggestion">${escapeHtml(d.suggestion)}</td>` : '<td></td>'}
            </tr>`,
          )
          .join('');
        return `
        <details class="file-block" open>
          <summary class="file-summary">
            <span class="file-path">${escapeHtml(file)}</span>
            <span class="file-count">${diagnostics.length} diagnostic(s)</span>
          </summary>
          <div class="table-wrap">
            <table class="diagnostics-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Rule</th>
                  <th>Message</th>
                  <th>Location</th>
                  <th>Suggestion</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>`;
      })
      .join('');
    diagnosticsSection = `
    <section class="diagnostics" aria-label="Diagnostics">
      <div class="filter-wrap">
        <label for="report-filter">Filter</label>
        <input type="search" id="report-filter" placeholder="Search by rule, message, file…" autocomplete="off" />
      </div>
      <div class="file-blocks">${fileSections}</div>
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>skill-check Report</title>
  <style>
    :root {
      --bg: #f8fafc;
      --bg-card: #fff;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --error: #dc2626;
      --warn: #d97706;
      --pass: #16a34a;
      --code-bg: #f1f5f9;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --bg-card: #1e293b;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --border: #334155;
        --code-bg: #334155;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg);
      margin: 0;
      padding: 1rem 1.5rem 2rem;
      max-width: 1200px;
      margin-inline: auto;
    }
    header {
      margin-bottom: 1.5rem;
    }
    header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0;
    }
    .summary {
      margin-bottom: 2rem;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
    }
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    .summary-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .summary-value.severity-error { color: var(--error); }
    .summary-value.severity-warn { color: var(--warn); }
    .summary-label {
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .status-badge .summary-value {
      font-size: 1.25rem;
    }
    .status-badge.status-fail .summary-value { color: var(--error); }
    .status-badge.status-warn .summary-value { color: var(--warn); }
    .status-badge.status-pass .summary-value { color: var(--pass); }
    .diagnostics h2 {
      font-size: 1.125rem;
      margin-bottom: 0.75rem;
    }
    .filter-wrap {
      margin-bottom: 1rem;
    }
    .filter-wrap label {
      margin-right: 0.5rem;
      color: var(--text-muted);
    }
    .filter-wrap input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-card);
      color: var(--text);
      width: min(100%, 320px);
    }
    .file-blocks { display: flex; flex-direction: column; gap: 0.75rem; }
    .file-block {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .file-summary {
      padding: 0.75rem 1rem;
      cursor: pointer;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .file-path { word-break: break-all; }
    .file-count { font-size: 0.875rem; color: var(--text-muted); flex-shrink: 0; }
    .table-wrap { overflow-x: auto; }
    .diagnostics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .diagnostics-table th,
    .diagnostics-table td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-top: 1px solid var(--border);
    }
    .diagnostics-table th {
      color: var(--text-muted);
      font-weight: 500;
    }
    .diagnostic-row.hidden { display: none; }
    .severity-error { color: var(--error); font-weight: 600; }
    .severity-warn { color: var(--warn); font-weight: 600; }
    .rule-id code {
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.8125rem;
    }
    .no-diagnostics { color: var(--text-muted); margin: 0; }
    .scores { margin-top: 2rem; }
    .scores h2 { font-size: 1.125rem; margin-bottom: 0.75rem; }
    .scores-grid { display: flex; flex-direction: column; gap: 0.5rem; }
    .score-card { display: flex; align-items: center; gap: 0.75rem; }
    .score-bar {
      width: 120px; height: 20px; background: var(--border); border-radius: 4px;
      position: relative; overflow: hidden; flex-shrink: 0;
    }
    .score-bar::before {
      content: ''; position: absolute; inset: 0;
      width: var(--score-pct); background: var(--score-color);
      border-radius: 4px; transition: width 0.3s;
    }
    .score-value {
      position: relative; z-index: 1; font-size: 0.75rem; font-weight: 700;
      color: #fff; padding-left: 6px; line-height: 20px;
    }
    .score-path { font-size: 0.875rem; color: var(--text-muted); word-break: break-all; }
    footer {
      margin-top: 2rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <header>
    <h1>skill-check Report</h1>
  </header>
  ${summarySection}
  ${diagnosticsSection}
  ${
    scores && scores.length > 0
      ? `
  <section class="scores" aria-label="Quality Scores">
    <h2>Quality Scores</h2>
    <div class="scores-grid">${scores
      .map(
        (s) => `
      <div class="score-card">
        <div class="score-bar" style="--score-pct: ${s.score}%; --score-color: ${scoreColor(s.score)}">
          <span class="score-value">${s.score}</span>
        </div>
        <span class="score-path">${escapeHtml(s.relativePath)}</span>
      </div>`,
      )
      .join('')}
    </div>
  </section>`
      : ''
  }
  <footer>
    Generated: ${escapeHtml(generated)}
  </footer>
  <script>
    (function() {
      var filter = document.getElementById('report-filter');
      if (!filter) return;
      var rows = document.querySelectorAll('.diagnostic-row');
      filter.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        rows.forEach(function(row) {
          var text = (row.getAttribute('data-search') || '');
          row.classList.toggle('hidden', q && text.indexOf(q) === -1);
        });
      });
    })();
  </script>
</body>
</html>`;
}
