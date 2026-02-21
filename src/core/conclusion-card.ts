import pc from 'picocolors';

const pcForced = pc.createColors(true);
type Colors = ReturnType<typeof pc.createColors>;

export type ValidationStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED';
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

function colorizeByScore(
  c: Colors,
  score: number | null,
  text: string,
): string {
  if (score === null) return c.dim(text);
  if (score >= 90) return c.green(text);
  if (score >= 75) return c.cyan(text);
  if (score >= 50) return c.yellow(text);
  return c.red(text);
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
  c: Colors,
  score: number | null,
  mode: ConclusionCardMode = 'default',
): FramedLine {
  const emptyChar = mode === 'share' ? '·' : '░';
  if (score === null) {
    const empty = emptyChar.repeat(SCORE_BAR_WIDTH);
    return createLine(empty, c.dim(empty));
  }

  const filledCount = Math.round((score / 100) * SCORE_BAR_WIDTH);
  const emptyCount = SCORE_BAR_WIDTH - filledCount;
  const filled = '█'.repeat(filledCount);
  const empty = emptyChar.repeat(emptyCount);
  return createLine(
    `${filled}${empty}`,
    `${colorizeByScore(c, score, filled)}${c.dim(empty)}`,
  );
}

function renderValidationStatus(c: Colors, status: ValidationStatus): string {
  if (status === 'PASS') return c.green(status);
  if (status === 'WARN') return c.yellow(status);
  if (status === 'SKIPPED') return c.dim(status);
  return c.red(status);
}

function renderSecurityStatus(c: Colors, status: SecurityStatus): string {
  if (status === 'PASS') return c.green(status);
  if (status === 'FAIL') return c.red(status);
  return c.yellow(status);
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
  const c: Colors = mode === 'share' ? pcForced : pc;
  const scoreValue =
    input.overallScore === null
      ? '--'
      : String(Math.max(0, input.overallScore));
  const label = scoreLabel(input.overallScore);
  const scoreLinePlain = `${scoreValue} / 100  ${label}`;
  const scoreLineRendered = `${colorizeByScore(c, input.overallScore, scoreValue)} / 100  ${colorizeByScore(c, input.overallScore, label)}`;
  const scoreBar = renderScoreBar(c, input.overallScore, mode);

  const validationLinePlain = `validation ${input.validationStatus} | security ${input.securityStatus}`;
  const validationLineRendered = `${c.bold('validation')} ${renderValidationStatus(c, input.validationStatus)} ${c.dim('|')} ${c.bold('security')} ${renderSecurityStatus(c, input.securityStatus)}`;

  const errorsText = `✖ ${input.errorCount} error${input.errorCount === 1 ? '' : 's'}`;
  const warningsText = `⚠ ${input.warningCount} warning${input.warningCount === 1 ? '' : 's'}`;
  const skillCountText = `${input.skillCount} skill${input.skillCount === 1 ? '' : 's'}`;
  const filesText = `across ${input.affectedFileCount} file${input.affectedFileCount === 1 ? '' : 's'}`;
  const elapsedText = `in ${formatElapsed(input.elapsedMs)}`;

  const countsLinePlain = `${errorsText}  ${warningsText}  ${skillCountText}  ${filesText}  ${elapsedText}`;
  const countsLineRendered =
    `${input.errorCount > 0 ? c.red(errorsText) : c.dim(errorsText)}  ` +
    `${input.warningCount > 0 ? c.yellow(warningsText) : c.dim(warningsText)}  ` +
    `${c.dim(skillCountText)}  ${c.dim(filesText)}  ${c.dim(elapsedText)}`;

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
      createLine(title, `${c.bold(c.cyan('skill-check'))} ${c.bold('cli')}`),
      createLine(''),
    );
  } else {
    lines.push(
      createLine('  .--------.', c.cyan('  .--------.')),
      createLine('  | skill  |', c.cyan('  | skill  |')),
      createLine('  | check  |', c.cyan('  | check  |')),
      createLine("  '--------'", c.cyan("  '--------'")),
      createLine(''),
      createLine(title, `${c.bold('skill-check')} ${c.dim('cli')}`),
      createLine(''),
    );
  }

  if (runCommandPreview) {
    lines.push(
      createLine(
        `run: ${runCommandPreview}`,
        `${c.bold('run:')} ${c.cyan(runCommandPreview)}`,
      ),
    );
    if (runCommandWasTruncated) {
      lines.push(createLine('full command below', c.dim('full command below')));
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
        `${c.bold('try it:')} ${c.cyan('npx skill-check <path-or-github-url>')}`,
      ),
      createLine(
        'npm: https://www.npmjs.com/package/skill-check',
        `${c.bold('npm:')} ${c.dim('https://www.npmjs.com/package/skill-check')}`,
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
