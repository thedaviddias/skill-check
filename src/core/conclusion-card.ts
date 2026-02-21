import pc from 'picocolors';

export type ValidationStatus = 'PASS' | 'WARN' | 'FAIL';
export type SecurityStatus = 'PASS' | 'FAIL' | 'SKIPPED';
export type ConclusionCardMode = 'default' | 'share';

export interface ConclusionCardInput {
  skillCount: number;
  errorCount: number;
  warningCount: number;
  affectedFileCount: number;
  overallScore: number | null;
  validationStatus: ValidationStatus;
  securityStatus: SecurityStatus;
  elapsedMs: number;
  runCommand?: string;
  title?: string;
  mode?: ConclusionCardMode;
}

export interface ConclusionCardRenderResult {
  card: string;
  fullCommandPlain?: string;
}

interface FramedLine {
  plainText: string;
  renderedText: string;
}

const SCORE_BAR_WIDTH = 30;
const RUN_COMMAND_PREVIEW_LIMIT = 56;
const SHARE_CARD_MIN_WIDTH = 74;

function createLine(plainText: string, renderedText = plainText): FramedLine {
  return { plainText, renderedText };
}

function padLine(line: FramedLine, width: number): string {
  const trailing = ' '.repeat(Math.max(0, width - line.plainText.length));
  return `| ${line.renderedText}${trailing} |`;
}

function colorizeByScore(score: number | null, text: string): string {
  if (score === null) return pc.dim(text);
  if (score >= 90) return pc.green(text);
  if (score >= 75) return pc.cyan(text);
  if (score >= 50) return pc.yellow(text);
  return pc.red(text);
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'No skills';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Solid';
  if (score >= 50) return 'Needs work';
  return 'Critical';
}

function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `${Math.max(0, Math.round(elapsedMs))}ms`;
  }
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function renderScoreBar(
  score: number | null,
  mode: ConclusionCardMode = 'default',
): FramedLine {
  const emptyChar = mode === 'share' ? '·' : '░';
  if (score === null) {
    const empty = emptyChar.repeat(SCORE_BAR_WIDTH);
    return createLine(empty, pc.dim(empty));
  }

  const filledCount = Math.round((score / 100) * SCORE_BAR_WIDTH);
  const emptyCount = SCORE_BAR_WIDTH - filledCount;
  const filled = '█'.repeat(filledCount);
  const empty = emptyChar.repeat(emptyCount);
  return createLine(
    `${filled}${empty}`,
    `${colorizeByScore(score, filled)}${pc.dim(empty)}`,
  );
}

function renderValidationStatus(status: ValidationStatus): string {
  if (status === 'PASS') return pc.green(status);
  if (status === 'WARN') return pc.yellow(status);
  return pc.red(status);
}

function renderSecurityStatus(status: SecurityStatus): string {
  if (status === 'PASS') return pc.green(status);
  if (status === 'FAIL') return pc.red(status);
  return pc.yellow(status);
}

function truncateRunCommand(
  value: string,
  maxLength: number,
): { text: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }

  if (maxLength <= 1) {
    return { text: '…', truncated: true };
  }

  return {
    text: `${value.slice(0, maxLength - 1)}…`,
    truncated: true,
  };
}

export function renderConclusionCard(
  input: ConclusionCardInput,
): ConclusionCardRenderResult {
  const mode = input.mode ?? 'default';
  const scoreValue =
    input.overallScore === null
      ? '--'
      : String(Math.max(0, input.overallScore));
  const label = scoreLabel(input.overallScore);
  const scoreLinePlain = `${scoreValue} / 100  ${label}`;
  const scoreLineRendered = `${colorizeByScore(input.overallScore, scoreValue)} / 100  ${colorizeByScore(input.overallScore, label)}`;
  const scoreBar = renderScoreBar(input.overallScore, mode);

  const validationLinePlain = `validation ${input.validationStatus} | security ${input.securityStatus}`;
  const validationLineRendered = `${pc.bold('validation')} ${renderValidationStatus(input.validationStatus)} ${pc.dim('|')} ${pc.bold('security')} ${renderSecurityStatus(input.securityStatus)}`;

  const errorsText = `✖ ${input.errorCount} error${input.errorCount === 1 ? '' : 's'}`;
  const warningsText = `⚠ ${input.warningCount} warning${input.warningCount === 1 ? '' : 's'}`;
  const skillCountText = `${input.skillCount} skill${input.skillCount === 1 ? '' : 's'}`;
  const filesText = `across ${input.affectedFileCount} file${input.affectedFileCount === 1 ? '' : 's'}`;
  const elapsedText = `in ${formatElapsed(input.elapsedMs)}`;

  const countsLinePlain = `${errorsText}  ${warningsText}  ${skillCountText}  ${filesText}  ${elapsedText}`;
  const countsLineRendered =
    `${input.errorCount > 0 ? pc.red(errorsText) : pc.dim(errorsText)}  ` +
    `${input.warningCount > 0 ? pc.yellow(warningsText) : pc.dim(warningsText)}  ` +
    `${pc.dim(skillCountText)}  ${pc.dim(filesText)}  ${pc.dim(elapsedText)}`;

  const title = input.title ?? 'skill-check cli';
  let fullCommandPlain: string | undefined;
  let runCommandPreview: string | undefined;
  let runCommandWasTruncated = false;
  if (input.runCommand) {
    const preview = truncateRunCommand(
      input.runCommand,
      RUN_COMMAND_PREVIEW_LIMIT,
    );
    runCommandPreview = preview.text;
    runCommandWasTruncated = preview.truncated;
    if (runCommandWasTruncated) {
      fullCommandPlain = input.runCommand;
    }
  }

  const lines: FramedLine[] = [];
  if (mode === 'share') {
    lines.push(
      createLine(title, `${pc.bold(pc.cyan('skill-check'))} ${pc.bold('cli')}`),
      createLine(''),
    );
  } else {
    lines.push(
      createLine('  .--------.', pc.cyan('  .--------.')),
      createLine('  | skill  |', pc.cyan('  | skill  |')),
      createLine('  | check  |', pc.cyan('  | check  |')),
      createLine("  '--------'", pc.cyan("  '--------'")),
      createLine(''),
      createLine(title, `${pc.bold('skill-check')} ${pc.dim('cli')}`),
      createLine(''),
    );
  }

  if (runCommandPreview) {
    lines.push(
      createLine(
        `run: ${runCommandPreview}`,
        `${pc.bold('run:')} ${pc.cyan(runCommandPreview)}`,
      ),
    );
    if (runCommandWasTruncated) {
      lines.push(
        createLine('full command below', pc.dim('full command below')),
      );
    }
  }

  lines.push(
    createLine(''),
    createLine(scoreLinePlain, scoreLineRendered),
    createLine(''),
    scoreBar,
    createLine(''),
    createLine(validationLinePlain, validationLineRendered),
    createLine(countsLinePlain, countsLineRendered),
  );
  if (mode === 'share') {
    lines.push(
      createLine(''),
      createLine(
        'try it: npx skill-check <path-or-github-url>',
        `${pc.bold('try it:')} ${pc.cyan('npx skill-check <path-or-github-url>')}`,
      ),
      createLine(
        'npm: https://www.npmjs.com/package/skill-check',
        `${pc.bold('npm:')} ${pc.dim('https://www.npmjs.com/package/skill-check')}`,
      ),
    );
  }

  const width = Math.max(
    mode === 'share' ? SHARE_CARD_MIN_WIDTH : 0,
    ...lines.map((line) => line.plainText.length),
  );

  let card: string;
  if (mode === 'share') {
    card = lines
      .map((line) => {
        const trailing = ' '.repeat(Math.max(0, width - line.plainText.length));
        return `${line.renderedText}${trailing}`;
      })
      .join('\n');
  } else {
    const border = '-'.repeat(width + 2);
    const output: string[] = [`+${border}+`];
    for (const line of lines) {
      output.push(padLine(line, width));
    }
    output.push(`+${border}+`);
    card = output.join('\n');
  }

  return {
    card,
    fullCommandPlain,
  };
}
