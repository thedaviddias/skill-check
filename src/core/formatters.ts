import Table from 'cli-table3';
import pc from 'picocolors';
import type { AnalysisResult, Diagnostic } from '../types.js';
import {
  renderConclusionCard,
  type SecurityStatus,
  type ValidationStatus,
} from './conclusion-card.js';
import type { SkillScore } from './quality-score.js';

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const list = grouped.get(diagnostic.file) ?? [];
    list.push(diagnostic);
    grouped.set(diagnostic.file, list);
  }
  return grouped;
}

function renderDivider(char = '='): string {
  return char.repeat(72);
}

function renderSeverityLabel(severity: Diagnostic['severity']): string {
  if (severity === 'error') return pc.red(pc.bold('[ERROR]'));
  return pc.yellow(pc.bold('[WARN ]'));
}

function renderStatusTag(summary: AnalysisResult['summary']): string {
  if (summary.errorCount > 0) return pc.red(pc.bold('[FAIL]'));
  if (summary.warningCount > 0) return pc.yellow(pc.bold('[WARN]'));
  return pc.green(pc.bold('[PASS]'));
}

function createAsciiTable(): Table.Table {
  return new Table({
    chars: {
      top: '-',
      'top-mid': '+',
      'top-left': '+',
      'top-right': '+',
      bottom: '-',
      'bottom-mid': '+',
      'bottom-left': '+',
      'bottom-right': '+',
      left: '|',
      'left-mid': '+',
      mid: '-',
      'mid-mid': '+',
      right: '|',
      'right-mid': '+',
      middle: '|',
    },
    style: {
      border: [],
      compact: true,
      head: [],
    },
    wordWrap: true,
  });
}

function renderOverviewTable(
  result: AnalysisResult,
  fileCount: number,
): string {
  const status =
    result.summary.errorCount > 0
      ? pc.red('FAIL')
      : result.summary.warningCount > 0
        ? pc.yellow('WARN')
        : pc.green('PASS');

  const table = createAsciiTable();
  table.push(
    [
      pc.bold('Skills scanned'),
      pc.cyan(String(result.summary.skillCount)),
      pc.bold('Files flagged'),
      pc.cyan(String(fileCount)),
    ],
    [
      pc.bold('Diagnostics'),
      pc.cyan(String(result.diagnostics.length)),
      pc.bold('Errors'),
      pc.red(String(result.summary.errorCount)),
    ],
    [
      pc.bold('Warnings'),
      pc.yellow(String(result.summary.warningCount)),
      pc.bold('Status'),
      pc.bold(status),
    ],
  );
  return table.toString();
}

function renderScoreBar(score: number): string {
  const color = score >= 80 ? pc.green : score >= 50 ? pc.yellow : pc.red;
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return `${color('█'.repeat(filled))}${pc.dim('░'.repeat(empty))} ${color(String(score))}`;
}

function resolveValidationStatus(result: AnalysisResult): ValidationStatus {
  if (result.summary.errorCount > 0) return 'FAIL';
  if (result.summary.warningCount > 0) return 'WARN';
  return 'PASS';
}

function computeOverallScore(scores: SkillScore[] | undefined): number | null {
  if (!scores || scores.length === 0) return null;
  const total = scores.reduce((sum, score) => sum + score.score, 0);
  return Math.round(total / scores.length);
}

export interface RenderTextOptions {
  includeConclusion?: boolean;
  securityStatus?: SecurityStatus;
  elapsedMs?: number;
  affectedFileCount?: number;
  runCommand?: string;
  title?: string;
}

export function renderText(
  result: AnalysisResult,
  scores?: SkillScore[],
  options: RenderTextOptions = {},
): string {
  const lines: string[] = [];
  const grouped = groupByFile(result.diagnostics);
  const status = renderStatusTag(result.summary);

  lines.push(pc.dim(renderDivider('=')));
  lines.push(`${pc.bold('SKILL-CHECK VALIDATION REPORT')} ${status}`);
  lines.push(pc.dim(renderDivider('=')));
  lines.push(pc.bold('Overview'));
  lines.push(pc.dim(renderDivider('-')));
  lines.push(renderOverviewTable(result, grouped.size));
  lines.push('');

  if (grouped.size === 0) {
    lines.push(pc.bold('Results'));
    lines.push(pc.dim(renderDivider('-')));
    lines.push(`${pc.green('[OK]')} No diagnostics found.`);
    lines.push('');
  } else {
    lines.push(pc.bold('Results'));
    lines.push(pc.dim(renderDivider('-')));
    const sortedFiles = Array.from(grouped.keys()).sort();
    for (const file of sortedFiles) {
      const diagnostics = grouped.get(file);
      if (!diagnostics) continue;

      lines.push(`${pc.bold('[FILE]')} ${pc.bold(file)}`);
      lines.push(`  ${pc.dim(`diagnostics: ${diagnostics.length}`)}`);
      lines.push('');

      for (const diagnostic of diagnostics) {
        const location = `${diagnostic.line}:${diagnostic.column}`;
        lines.push(
          `  ${renderSeverityLabel(diagnostic.severity)} ${pc.cyan(diagnostic.ruleId)} ${pc.dim(`at ${location}`)}`,
        );
        lines.push(`    message    : ${diagnostic.message}`);
        if (diagnostic.suggestion) {
          lines.push(`    suggestion : ${pc.yellow(diagnostic.suggestion)}`);
        }
        lines.push('');
      }
    }
  }

  if (scores && scores.length > 0) {
    lines.push(pc.bold('Quality Scores'));
    lines.push(pc.dim(renderDivider('-')));
    for (const s of scores) {
      lines.push(`  ${renderScoreBar(s.score)} ${pc.dim(s.relativePath)}`);
    }
    lines.push('');
  }

  if (options.includeConclusion !== false) {
    const conclusion = renderConclusionCard({
      skillCount: result.summary.skillCount,
      errorCount: result.summary.errorCount,
      warningCount: result.summary.warningCount,
      affectedFileCount: options.affectedFileCount ?? grouped.size,
      overallScore: computeOverallScore(scores),
      validationStatus: resolveValidationStatus(result),
      securityStatus: options.securityStatus ?? 'SKIPPED',
      elapsedMs: options.elapsedMs ?? 0,
      runCommand: options.runCommand,
      title: options.title,
    });

    lines.push(pc.dim(renderDivider('-')));
    lines.push(conclusion.card);
    if (conclusion.fullCommandPlain) {
      lines.push(conclusion.fullCommandPlain);
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function toJson(result: AnalysisResult): Record<string, unknown> {
  return {
    summary: result.summary,
    diagnostics: result.diagnostics,
    metadata: {
      roots: result.config.roots,
      include: result.config.include,
      exclude: result.config.exclude,
      format: result.config.output.format,
    },
  };
}
