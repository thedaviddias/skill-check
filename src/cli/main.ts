import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  cancel as clackCancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  text,
} from '@clack/prompts';
import { Command, CommanderError } from 'commander';
import { Listr } from 'listr2';
import ora from 'ora';
import pc from 'picocolors';
import {
  type AgentScanInvocation,
  type AgentScanRunner,
  isCommandAvailable,
  isValidAgentScanRunner,
  resolveAgentScanInvocation,
  runAgentScan,
} from '../core/agent-scan.js';
import {
  analyze,
  analyzeWithConfig,
  ensureInitConfig,
  resolveExitCode,
  writeIfRequested,
} from '../core/analyze.js';
import {
  type BaselineDiff,
  diffBaseline,
  loadBaseline,
} from '../core/baseline.js';
import {
  renderConclusionCard,
  type SecurityStatus,
  type ValidationStatus,
} from '../core/conclusion-card.js';
import { resolveConfig } from '../core/config.js';
import { detectDuplicates } from '../core/duplicates.js';
import { CliError } from '../core/errors.js';
import {
  type AutoFixSummary,
  applyAutoFixes,
  isFixableRuleId,
} from '../core/fix.js';
import { renderText, toJson } from '../core/formatters.js';
import { toGitHubAnnotations } from '../core/github-formatter.js';
import { renderHtml } from '../core/html-report.js';
import { selectFixableDiagnostics } from '../core/interactive-fix.js';
import { openInBrowser } from '../core/open-browser.js';
import { computeSkillScores } from '../core/quality-score.js';
import {
  isGitHubRepoUrl,
  materializeRemoteTarget,
  type RemoteTargetProgressEvent,
} from '../core/remote-target.js';
import { renderMarkdownReport } from '../core/report.js';
import { toSarif } from '../core/sarif.js';
import { coreRules } from '../rules/core/index.js';
import type {
  AnalysisResult,
  CliOptions,
  Diagnostic,
  OutputFormat,
  ResolvedConfig,
} from '../types.js';

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultIO: CliIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const ROOT_COMMANDS = new Set([
  'check',
  'report',
  'security-scan',
  'rules',
  'new',
  'diff',
  'watch',
  'init',
  'help',
  'version',
]);

function collectList(value: string, previous: string[]): string[] {
  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...previous, ...parsed];
}

function parseNumber(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new CliError(`Expected a positive number, got "${value}".`, 2);
  }
  return num;
}

function addSharedOptions(command: Command): Command {
  return command
    .option('--config <path>', 'Path to skill-check config file')
    .option('--format <format>', 'Output format: text|json|sarif|html|github')
    .option('--strict', 'Treat warnings as errors')
    .option('--lenient', 'Disable selected strict rules')
    .option('--max-body-lines <n>', 'Override max body lines', parseNumber)
    .option(
      '--max-description-chars <n>',
      'Override max description chars',
      parseNumber,
    )
    .option('--include <glob>', 'Additional include glob(s)', collectList, [])
    .option('--exclude <glob>', 'Additional exclude glob(s)', collectList, [])
    .option('--fail-on-warning', 'Exit non-zero when warnings exist');
}

function addAgentScanOptions(command: Command): Command {
  return command
    .option(
      '--security-scan',
      'Run security scan as part of this command (enabled by default for check)',
    )
    .option('--no-security-scan', 'Skip security scan for this command')
    .option(
      '--security-scan-runner <runner>',
      'Security scan runner: auto|local|uvx|pipx',
      'auto',
    )
    .option(
      '--security-scan-mode <mode>',
      'Security scan mode (default: llmsecurity)',
      'llmsecurity',
    )
    .option(
      '--security-scan-paths <path>',
      'Comma-separated paths to scan (repeatable)',
      collectList,
      [],
    )
    .option(
      '--security-scan-skills <path>',
      'Comma-separated skills paths (repeatable)',
      collectList,
      [],
    )
    .option(
      '--allow-installs',
      'Allow automatic dependency installs for security scan runners',
    )
    .option(
      '--no-installs',
      'Disallow dependency installs for security scan runners',
    );
}

function normalizeCliOptions(raw: Record<string, unknown>): CliOptions {
  const format = raw.format;
  if (
    format &&
    !['text', 'json', 'sarif', 'html', 'github'].includes(String(format))
  ) {
    throw new CliError(
      `Invalid format "${String(format)}". Use text|json|sarif|html|github.`,
      2,
    );
  }

  return {
    configPath: typeof raw.config === 'string' ? raw.config : undefined,
    format: format as OutputFormat | undefined,
    strict: Boolean(raw.strict),
    lenient: Boolean(raw.lenient),
    maxBodyLines:
      typeof raw.maxBodyLines === 'number' ? raw.maxBodyLines : undefined,
    maxDescriptionChars:
      typeof raw.maxDescriptionChars === 'number'
        ? raw.maxDescriptionChars
        : undefined,
    include: Array.isArray(raw.include) ? (raw.include as string[]) : undefined,
    exclude: Array.isArray(raw.exclude) ? (raw.exclude as string[]) : undefined,
    failOnWarning: Boolean(raw.failOnWarning),
  };
}

interface AgentScanCliOptions {
  enabled: boolean;
  runner: AgentScanRunner;
  mode: string;
  paths?: string[];
  skills?: string[];
  installPolicy: 'allow' | 'deny';
}

interface InitCommandOptions {
  force?: boolean;
  interactive?: boolean;
}

interface CheckCommandOptions {
  fix: boolean;
  interactive: boolean;
}

interface ResolvedCommandTarget {
  target: string | undefined;
  isRemote: boolean;
  cleanup?: () => void;
}

interface ResolveTargetOptions {
  onProgress?: (event: RemoteTargetProgressEvent) => void;
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRootCommandArgs(argv: string[]): string[] {
  if (argv.length === 0) {
    return argv;
  }

  const [first] = argv;
  if (!first || first.startsWith('-') || ROOT_COMMANDS.has(first)) {
    return argv;
  }

  return ['check', ...argv];
}

function shellQuoteArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildShareableRunCommand(args: string[]): string {
  if (args.length === 0) {
    return 'npx skill-check';
  }

  return `npx skill-check ${args.map(shellQuoteArg).join(' ')}`;
}

function normalizeCheckCommandOptions(
  raw: Record<string, unknown>,
): CheckCommandOptions {
  return {
    fix: raw.fix === true,
    interactive: raw.interactive === true,
  };
}

function resolveCommandTarget(
  target: string | undefined,
  options: ResolveTargetOptions = {},
): ResolvedCommandTarget {
  if (!target || !isGitHubRepoUrl(target)) {
    return {
      target,
      isRemote: false,
    };
  }

  const materialized = materializeRemoteTarget(target, {
    onProgress: options.onProgress,
  });
  return {
    target: materialized.path,
    isRemote: true,
    cleanup: materialized.cleanup,
  };
}

async function withResolvedTarget<T>(
  target: string | undefined,
  run: (resolved: ResolvedCommandTarget) => Promise<T>,
): Promise<T> {
  const resolved = resolveCommandTarget(target);
  try {
    return await run(resolved);
  } finally {
    resolved.cleanup?.();
  }
}

interface RemoteTargetLoader {
  start: (url: string) => void;
  onProgress: (event: RemoteTargetProgressEvent) => void;
  fail: (error: unknown) => void;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createRemoteTargetLoader(io: CliIO): RemoteTargetLoader {
  const useSpinner = shouldUseInteractiveUi(io);
  const spinner = useSpinner ? ora() : null;
  let finished = false;
  let failedViaEvent = false;

  const write = (message: string): void => {
    io.stderr(`${message}\n`);
  };

  const update = (message: string): void => {
    if (finished) return;
    if (spinner) {
      if (spinner.isSpinning) {
        spinner.text = message;
      } else {
        spinner.start(message);
      }
      return;
    }
    write(`[remote] ${message}`);
  };

  const succeed = (message: string): void => {
    if (finished) return;
    if (spinner) {
      if (spinner.isSpinning) {
        spinner.succeed(message);
      } else {
        write(`[remote] ${message}`);
      }
    } else {
      write(`[remote] ${message}`);
    }
    finished = true;
  };

  const failInternal = (message: string): void => {
    if (finished) return;
    if (spinner) {
      if (spinner.isSpinning) {
        spinner.fail(message);
      } else {
        write(`[remote] ${message}`);
      }
    } else {
      write(`[remote] ${message}`);
    }
    finished = true;
  };

  return {
    start: (url: string) => {
      update(`Preparing remote target: ${url}`);
    },
    onProgress: (event: RemoteTargetProgressEvent) => {
      if (event.type === 'clone_start') {
        const refLabel = event.ref ? ` (ref: ${event.ref})` : '';
        update(`Cloning ${event.cloneUrl}${refLabel}`);
        return;
      }
      if (event.type === 'clone_done') {
        update(`Clone complete: ${event.checkoutPath}`);
        return;
      }
      if (event.type === 'subpath_start') {
        update(`Resolving subpath: ${event.subpath}`);
        return;
      }
      if (event.type === 'ready') {
        succeed(`Remote target ready: ${event.targetPath}`);
        return;
      }
      failedViaEvent = true;
      failInternal(`Remote target failed: ${event.message}`);
    },
    fail: (error: unknown) => {
      if (failedViaEvent) return;
      failInternal(`Remote target failed: ${toErrorMessage(error)}`);
    },
  };
}

async function withResolvedTargetFeedback<T>(
  target: string | undefined,
  io: CliIO,
  run: (resolved: ResolvedCommandTarget) => Promise<T>,
): Promise<T> {
  if (!target || !isGitHubRepoUrl(target)) {
    return withResolvedTarget(target, run);
  }

  const loader = createRemoteTargetLoader(io);
  loader.start(target);
  let resolved: ResolvedCommandTarget | undefined;
  try {
    resolved = resolveCommandTarget(target, {
      onProgress: (event) => loader.onProgress(event),
    });
    return await run(resolved);
  } catch (error) {
    loader.fail(error);
    throw error;
  } finally {
    resolved?.cleanup?.();
  }
}

function assertLocalOnlyTarget(
  target: string | undefined,
  commandName: string,
): void {
  if (!target || !isGitHubRepoUrl(target)) return;
  throw new CliError(
    `${commandName} does not support GitHub URL targets yet. Clone locally and re-run ${commandName}.`,
    2,
  );
}

async function runInteractiveInit(
  cwd: string,
  target: string | undefined,
  options: InitCommandOptions,
): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      'Interactive init requires a TTY. Run without --interactive in non-interactive environments.',
      2,
    );
  }

  intro('skill-check init wizard');

  const defaultPath = path.resolve(cwd, target ?? 'skill-check.config.json');
  const configPathAnswer = await text({
    message: 'Config file path',
    initialValue: defaultPath,
    placeholder: 'skill-check.config.json',
  });
  if (isCancel(configPathAnswer)) {
    clackCancel('Initialization cancelled.');
    return 1;
  }

  const rootsAnswer = await text({
    message: 'Roots to scan (comma-separated)',
    initialValue: '.',
    placeholder: '.',
  });
  if (isCancel(rootsAnswer)) {
    clackCancel('Initialization cancelled.');
    return 1;
  }

  const formatAnswer = await select({
    message: 'Default output format',
    initialValue: 'text',
    options: [
      { value: 'text', label: 'text', hint: 'human-readable console output' },
      { value: 'json', label: 'json', hint: 'machine-readable output' },
      { value: 'sarif', label: 'sarif', hint: 'security tooling format' },
      { value: 'html', label: 'html', hint: 'self-contained HTML report' },
      { value: 'github', label: 'github', hint: 'GitHub Actions annotations' },
    ],
  });
  if (isCancel(formatAnswer)) {
    clackCancel('Initialization cancelled.');
    return 1;
  }

  const parsedRoots = parseCommaSeparated(rootsAnswer.toString());
  const roots = parsedRoots.length > 0 ? parsedRoots : ['.'];
  const filePath = path.resolve(cwd, configPathAnswer.toString());
  let force = Boolean(options.force);

  if (fs.existsSync(filePath) && !force) {
    const overwriteAnswer = await confirm({
      message: `Config already exists at ${filePath}. Overwrite?`,
      initialValue: false,
    });
    if (isCancel(overwriteAnswer) || !overwriteAnswer) {
      clackCancel('Initialization cancelled.');
      return 1;
    }
    force = true;
  }

  ensureInitConfig(filePath, force);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
  parsed.roots = roots;
  parsed.output = {
    ...(parsed.output && typeof parsed.output === 'object'
      ? (parsed.output as Record<string, unknown>)
      : {}),
    format: formatAnswer as OutputFormat,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`);

  outro(`Created ${filePath}`);
  return 0;
}

function normalizeAgentScanOptions(
  raw: Record<string, unknown>,
): AgentScanCliOptions {
  const rawRunner =
    typeof raw.securityScanRunner === 'string'
      ? raw.securityScanRunner
      : 'auto';
  if (!isValidAgentScanRunner(rawRunner)) {
    throw new CliError(
      `Invalid --security-scan-runner "${rawRunner}". Use auto|local|uvx|pipx.`,
      2,
    );
  }

  const mode =
    typeof raw.securityScanMode === 'string' && raw.securityScanMode.trim()
      ? raw.securityScanMode.trim()
      : 'llmsecurity';

  const selectedPaths =
    Array.isArray(raw.securityScanPaths) && raw.securityScanPaths.length > 0
      ? (raw.securityScanPaths as string[])
      : undefined;

  const selectedSkills =
    Array.isArray(raw.securityScanSkills) && raw.securityScanSkills.length > 0
      ? (raw.securityScanSkills as string[])
      : undefined;

  const allowInstalls =
    raw.allowInstalls === true ||
    isTruthyFlag(process.env.SKILL_CHECK_ALLOW_INSTALLS);
  const denyInstalls =
    raw.installs === false || isTruthyFlag(process.env.SKILL_CHECK_NO_INSTALLS);
  if (allowInstalls && denyInstalls) {
    throw new CliError(
      'Cannot use --allow-installs and --no-installs together.',
      2,
    );
  }

  return {
    enabled: raw.securityScan !== false,
    runner: rawRunner,
    mode,
    paths: selectedPaths,
    skills: selectedSkills,
    installPolicy: denyInstalls ? 'deny' : 'allow',
  };
}

function shouldUseInteractiveUi(io: CliIO): boolean {
  return (
    io === defaultIO &&
    Boolean(process.stdout.isTTY) &&
    Boolean(process.stderr.isTTY)
  );
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}

function shouldRenderBanner(io: CliIO, format: OutputFormat): boolean {
  return (
    io === defaultIO &&
    format === 'text' &&
    !isTruthyFlag(process.env.CI) &&
    !isTruthyFlag(process.env.SKILL_CHECK_NO_BANNER)
  );
}

function renderAsciiBanner(): string {
  const art = [
    '  ____  _  _____ _     _        ____ _   _ _____ ____ _  __',
    ' / ___|| |/ /_ _| |   | |      / ___| | | | ____/ ___| |/ /',
    " \\___ \\| ' / | || |   | |     | |   | |_| |  _|| |   | ' / ",
    '  ___) | . \\ | || |___| |___  | |___|  _  | |__| |___| . \\ ',
    ' |____/|_|\\_\\___|_____|_____|  \\____|_| |_|_____\\____|_|\\_\\',
  ].join('\n');
  return `${pc.cyan(pc.bold(art))}\n${pc.dim('Validate skills and security checks in one pass.')}\n\n`;
}

function renderAutoFixSummary(summary: AutoFixSummary): string {
  const lines: string[] = [];
  lines.push(`${pc.bold('Auto-fix:')} ${pc.cyan('analysis complete')}`);
  lines.push(
    `  requested=${pc.cyan(String(summary.requestedDiagnostics))} supported=${pc.cyan(String(summary.supportedDiagnostics))} unsupported=${pc.yellow(String(summary.unsupportedDiagnostics))}`,
  );
  lines.push(
    `  applied=${summary.appliedFixes > 0 ? pc.green(String(summary.appliedFixes)) : pc.yellow('0')} files=${pc.cyan(String(summary.filesUpdated))}`,
  );

  if (summary.updatedFiles.length > 0) {
    lines.push('  updated files:');
    for (const file of summary.updatedFiles) {
      lines.push(`    - ${file}`);
    }
  } else {
    lines.push('  updated files: none');
  }

  return `${lines.join('\n')}\n\n`;
}

async function ensureSecurityScanInstallConsent(
  scanOptions: AgentScanCliOptions,
  invocation: AgentScanInvocation,
): Promise<void> {
  const mayInstallDependency =
    invocation.command !== 'mcp-scan' && !isCommandAvailable('mcp-scan');
  if (!mayInstallDependency) return;

  if (scanOptions.installPolicy === 'allow') return;

  throw new CliError(
    `Security scan may install dependencies via ${invocation.command}. Re-run without --no-installs, install mcp-scan manually, or skip scan with --no-security-scan.`,
    2,
  );
}

async function runValidationPipeline(
  cwd: string,
  config: ResolvedConfig,
  interactiveUi: boolean,
): Promise<AnalysisResult> {
  const useTaskUi = interactiveUi && config.output.format === 'text';
  if (!useTaskUi) {
    return analyzeWithConfig(cwd, config);
  }

  const context: { result?: AnalysisResult } = {};
  const tasks = new Listr<typeof context>([
    {
      title: 'Discover and validate skills',
      task: async (ctx, task) => {
        ctx.result = await analyzeWithConfig(cwd, config);
        task.output = `${ctx.result.summary.skillCount} skill(s), ${ctx.result.diagnostics.length} diagnostic(s)`;
      },
    },
  ]);
  await tasks.run(context);

  if (!context.result) {
    throw new CliError('Validation pipeline did not produce a result.', 2);
  }
  return context.result;
}

async function runAgentScanWithFeedback(
  scanOptions: AgentScanCliOptions,
  target: string | undefined,
  io: CliIO,
  format: OutputFormat,
): Promise<number> {
  const useInteractiveFeedback =
    shouldUseInteractiveUi(io) && format === 'text';

  const invocation = resolveAgentScanInvocation({
    cwd: process.cwd(),
    targetPath: target,
    mode: scanOptions.mode,
    runner: scanOptions.runner,
    paths: scanOptions.paths,
    skills: scanOptions.skills,
  });

  if (format === 'text') {
    io.stdout(
      `${pc.dim('Security scan engine:')} ${pc.bold('agent-scan (mcp-scan)')} ${pc.dim('via')} ${pc.cyan(invocation.command)}\n`,
    );
  }

  await ensureSecurityScanInstallConsent(scanOptions, invocation);

  if (useInteractiveFeedback) {
    ora().info('Running security scan...');
  }

  try {
    const exitCode = runAgentScan({
      cwd: process.cwd(),
      targetPath: target,
      mode: scanOptions.mode,
      runner: scanOptions.runner,
      paths: scanOptions.paths,
      skills: scanOptions.skills,
    });

    if (useInteractiveFeedback) {
      if (exitCode === 0) {
        ora().succeed('Security scan completed without blocking findings.');
      } else {
        ora().warn('Security scan reported findings.');
      }
    }

    return exitCode;
  } catch (error) {
    if (useInteractiveFeedback) {
      ora().fail('Security scan failed to execute.');
    }
    throw error;
  }
}

function resolveValidationStatus(result: AnalysisResult): ValidationStatus {
  if (result.summary.errorCount > 0) return 'FAIL';
  if (result.summary.warningCount > 0) return 'WARN';
  return 'PASS';
}

function resolveSecurityStatus(
  enabled: boolean,
  scanExitCode: number | undefined,
): SecurityStatus {
  if (!enabled) return 'SKIPPED';
  return scanExitCode === 0 ? 'PASS' : 'FAIL';
}

function computeOverallScore(scores: { score: number }[]): number | null {
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, score) => sum + score.score, 0);
  return Math.round(total / scores.length);
}

function countAffectedFiles(diagnostics: Diagnostic[]): number {
  return new Set(diagnostics.map((diagnostic) => diagnostic.file)).size;
}

export async function runCli(
  argv: string[],
  io: CliIO = defaultIO,
): Promise<number> {
  const originalArgv = [...argv];
  const program = new Command();
  let finalExitCode = 0;
  let bannerRendered = false;

  const maybeRenderBanner = (format: OutputFormat): void => {
    if (bannerRendered) return;
    if (!shouldRenderBanner(io, format)) return;
    io.stdout(renderAsciiBanner());
    bannerRendered = true;
  };

  program
    .name('skill-check')
    .description('Linter for agent skill files')
    .showHelpAfterError(true)
    .exitOverride();

  addAgentScanOptions(
    addSharedOptions(
      program
        .command('check [target]')
        .description('Run validation checks')
        .option(
          '--fix',
          'Apply safe automatic fixes for supported validation findings',
        )
        .option(
          '--interactive',
          'Prompt before applying each fix (use with --fix)',
        )
        .option('--no-open', 'Do not open HTML report in browser')
        .option('--baseline <path>', 'Compare against a previous JSON run')
        .action(
          async (
            target: string | undefined,
            rawOptions: Record<string, unknown>,
          ) => {
            const checkStartedAt = performance.now();
            const runCommand = buildShareableRunCommand(originalArgv);
            const options = normalizeCliOptions(rawOptions);
            const checkOptions = normalizeCheckCommandOptions(rawOptions);
            const scanOptions = normalizeAgentScanOptions(rawOptions);
            if (checkOptions.fix && target && isGitHubRepoUrl(target)) {
              throw new CliError(
                'Cannot use --fix with a GitHub URL target. Clone locally to apply persistent fixes.',
                2,
              );
            }
            await withResolvedTargetFeedback(
              target,
              io,
              async (resolvedTarget) => {
                const cwd = resolvedTarget.target ?? process.cwd();
                const config = await resolveConfig(
                  cwd,
                  resolvedTarget.target,
                  options,
                );
                maybeRenderBanner(config.output.format);
                let result = await runValidationPipeline(
                  cwd,
                  config,
                  shouldUseInteractiveUi(io),
                );
                let fixSummary: AutoFixSummary | undefined;

                if (checkOptions.fix) {
                  if (checkOptions.interactive && shouldUseInteractiveUi(io)) {
                    const { accepted, skipped } =
                      await selectFixableDiagnostics(result);
                    if (accepted.length > 0) {
                      const filteredResult = {
                        ...result,
                        diagnostics: accepted,
                      };
                      fixSummary = applyAutoFixes(filteredResult);
                      fixSummary.unsupportedDiagnostics +=
                        result.diagnostics.length - accepted.length - skipped;
                    } else {
                      fixSummary = {
                        requestedDiagnostics: result.diagnostics.length,
                        supportedDiagnostics: 0,
                        unsupportedDiagnostics: result.diagnostics.length,
                        appliedFixes: 0,
                        filesUpdated: 0,
                        updatedFiles: [],
                      };
                    }
                  } else {
                    fixSummary = applyAutoFixes(result);
                  }
                  if (fixSummary.appliedFixes > 0) {
                    result = await runValidationPipeline(
                      cwd,
                      config,
                      shouldUseInteractiveUi(io),
                    );
                  }
                }

                const duplicateDiags = detectDuplicates(result.skills);
                if (duplicateDiags.length > 0) {
                  result = {
                    ...result,
                    diagnostics: [...result.diagnostics, ...duplicateDiags],
                    summary: {
                      ...result.summary,
                      warningCount:
                        result.summary.warningCount +
                        duplicateDiags.filter((d) => d.severity === 'warn')
                          .length,
                      errorCount:
                        result.summary.errorCount +
                        duplicateDiags.filter((d) => d.severity === 'error')
                          .length,
                    },
                  };
                }

                const scores = computeSkillScores(
                  result.skills,
                  result.diagnostics,
                );
                const format = result.config.output.format;

                let baselineDiff: BaselineDiff | undefined;
                const baselinePath =
                  typeof rawOptions.baseline === 'string'
                    ? rawOptions.baseline
                    : undefined;
                if (baselinePath) {
                  const baselineDiags = loadBaseline(
                    path.resolve(process.cwd(), baselinePath),
                  );
                  baselineDiff = diffBaseline(
                    result.diagnostics,
                    baselineDiags,
                  );
                }

                if (format === 'json') {
                  const jsonData = toJson(result) as Record<string, unknown>;
                  jsonData.scores = scores;
                  if (baselineDiff) {
                    jsonData.baseline = {
                      new: baselineDiff.newDiagnostics.length,
                      fixed: baselineDiff.fixedDiagnostics.length,
                      unchanged: baselineDiff.unchanged.length,
                    };
                  }
                  const output = `${JSON.stringify(jsonData, null, 2)}\n`;
                  io.stdout(output);
                  const written = writeIfRequested(result.config, output);
                  if (written) io.stdout(`Wrote ${written}\n`);
                } else if (format === 'sarif') {
                  const output = `${JSON.stringify(toSarif(result), null, 2)}\n`;
                  io.stdout(output);
                  const written = writeIfRequested(result.config, output);
                  if (written) io.stdout(`Wrote ${written}\n`);
                } else if (format === 'github') {
                  const output = toGitHubAnnotations(result);
                  if (output) io.stdout(output);
                } else if (format === 'html') {
                  const html = renderHtml(result, scores);
                  const reportPath =
                    result.config.output.reportPath ??
                    path.join(result.config.cwd, 'skill-check-report.html');
                  const parent = path.dirname(reportPath);
                  fs.mkdirSync(parent, { recursive: true });
                  fs.writeFileSync(reportPath, html);
                  const shouldOpen =
                    Boolean(process.stdout.isTTY) &&
                    !process.env.CI &&
                    rawOptions.noOpen !== true;
                  if (shouldOpen) {
                    try {
                      openInBrowser(reportPath);
                    } catch {
                      // ignore open failures
                    }
                  }
                  io.stdout(`Wrote ${reportPath}\n`);
                } else {
                  if (fixSummary) {
                    io.stdout(renderAutoFixSummary(fixSummary));
                  }
                  io.stdout(
                    renderText(result, scores, {
                      includeConclusion: false,
                    }),
                  );
                }

                if (baselineDiff && (format === 'text' || format === 'html')) {
                  io.stdout(
                    `${pc.bold('Baseline:')} ${pc.green(`${baselineDiff.fixedDiagnostics.length} fixed`)} ${pc.red(`${baselineDiff.newDiagnostics.length} new`)} ${pc.dim(`${baselineDiff.unchanged.length} unchanged`)}\n`,
                  );
                }

                const validationExitCode = resolveExitCode(result);
                let exitCode = validationExitCode;
                if (format === 'html') {
                  io.stdout(
                    `${pc.bold('Validation:')} ${validationExitCode === 0 ? pc.green('PASS') : pc.red('FAIL')}\n`,
                  );
                }
                let scanExitCode: number | undefined;
                if (scanOptions.enabled) {
                  scanExitCode = await runAgentScanWithFeedback(
                    scanOptions,
                    resolvedTarget.target,
                    io,
                    format,
                  );
                  if (format === 'html') {
                    io.stdout(
                      `${pc.bold('Security scan:')} ${scanExitCode === 0 ? pc.green('PASS') : pc.red('FAIL')}\n`,
                    );
                  }
                  if (scanExitCode !== 0) {
                    exitCode = 1;
                  }
                } else if (format === 'html') {
                  io.stdout(
                    `${pc.bold('Security scan:')} ${pc.yellow('SKIPPED')}\n`,
                  );
                }

                if (format === 'text') {
                  const conclusion = renderConclusionCard({
                    skillCount: result.summary.skillCount,
                    errorCount: result.summary.errorCount,
                    warningCount: result.summary.warningCount,
                    affectedFileCount: countAffectedFiles(result.diagnostics),
                    overallScore: computeOverallScore(scores),
                    validationStatus: resolveValidationStatus(result),
                    securityStatus: resolveSecurityStatus(
                      scanOptions.enabled,
                      scanExitCode,
                    ),
                    elapsedMs: performance.now() - checkStartedAt,
                    runCommand,
                  });
                  io.stdout(`${conclusion.card}\n`);
                  if (conclusion.fullCommandPlain) {
                    io.stdout(`${conclusion.fullCommandPlain}\n`);
                  }
                }

                finalExitCode = exitCode;
              },
            );
          },
        ),
    ),
  );

  addSharedOptions(
    program
      .command('report [target]')
      .description('Generate markdown health report')
      .option('--no-open', 'Do not open HTML report in browser')
      .action(
        async (
          target: string | undefined,
          rawOptions: Record<string, unknown>,
        ) => {
          const options = normalizeCliOptions(rawOptions);
          await withResolvedTargetFeedback(
            target,
            io,
            async (resolvedTarget) => {
              const cwd = resolvedTarget.target ?? process.cwd();
              const result = await analyze(cwd, resolvedTarget.target, options);
              const format = result.config.output.format;
              if (format === 'html') {
                const html = renderHtml(result);
                const reportPath =
                  result.config.output.reportPath ??
                  path.join(result.config.cwd, 'skill-check-report.html');
                const parent = path.dirname(reportPath);
                fs.mkdirSync(parent, { recursive: true });
                fs.writeFileSync(reportPath, html);
                const shouldOpen =
                  Boolean(process.stdout.isTTY) &&
                  !process.env.CI &&
                  rawOptions.noOpen !== true;
                if (shouldOpen) {
                  try {
                    openInBrowser(reportPath);
                  } catch {
                    // ignore open failures
                  }
                }
                io.stdout(`Wrote ${reportPath}\n`);
              } else {
                const markdown = renderMarkdownReport(result);
                const written = writeIfRequested(result.config, markdown);
                io.stdout(markdown);
                if (written) io.stdout(`Wrote ${written}\n`);
              }
              finalExitCode = resolveExitCode(result);
            },
          );
        },
      ),
  );

  addAgentScanOptions(
    program
      .command('security-scan [target]')
      .description('Run security scan using agent-scan (mcp-scan)')
      .action(
        async (
          target: string | undefined,
          rawOptions: Record<string, unknown>,
        ) => {
          const scanOptions = normalizeAgentScanOptions({
            ...rawOptions,
            securityScan: true,
          });
          maybeRenderBanner('text');

          await withResolvedTargetFeedback(
            target,
            io,
            async (resolvedTarget) => {
              const scanExitCode = await runAgentScanWithFeedback(
                scanOptions,
                resolvedTarget.target,
                io,
                'text',
              );
              finalExitCode = scanExitCode === 0 ? 0 : 1;
            },
          );
        },
      ),
  );

  program
    .command('rules [ruleId]')
    .description('List built-in rules or show detail for a specific rule')
    .action((ruleId: string | undefined) => {
      if (!ruleId) {
        const lines = ['Built-in rules:\n'];
        for (const rule of coreRules) {
          const fixable = isFixableRuleId(rule.id)
            ? pc.green(' [fixable]')
            : '';
          lines.push(
            `  ${pc.cyan(rule.id)} ${pc.dim(`(${rule.defaultSeverity})`)}${fixable}`,
          );
          lines.push(`    ${pc.dim(rule.description)}`);
        }
        io.stdout(`${lines.join('\n')}\n`);
        finalExitCode = 0;
        return;
      }

      const rule = coreRules.find((r) => r.id === ruleId);
      if (!rule) {
        io.stderr(`Unknown rule: ${ruleId}\n`);
        finalExitCode = 2;
        return;
      }

      io.stdout(`${pc.bold(rule.id)}\n`);
      io.stdout(`  Severity : ${rule.defaultSeverity}\n`);
      io.stdout(`  Fixable  : ${isFixableRuleId(rule.id) ? 'yes' : 'no'}\n`);
      io.stdout(`  ${rule.description}\n`);
      finalExitCode = 0;
    });

  program
    .command('new <name>')
    .description('Scaffold a new skill directory with SKILL.md template')
    .option('--dir <directory>', 'Parent directory for the skill', 'skills')
    .action((name: string, options: { dir: string }) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const skillDir = path.resolve(process.cwd(), options.dir, slug);

      if (fs.existsSync(skillDir)) {
        io.stderr(`Directory already exists: ${skillDir}\n`);
        finalExitCode = 1;
        return;
      }

      fs.mkdirSync(skillDir, { recursive: true });
      const template = [
        '---',
        `name: ${slug}`,
        `description: Use when ${slug} functionality is needed. Describe triggers, constraints, and expected outcomes.`,
        '---',
        '',
        `# ${slug}`,
        '',
        '## When to use',
        '',
        'Describe when an agent should select this skill.',
        '',
        '## Instructions',
        '',
        'Step-by-step instructions for the agent.',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), template);
      io.stdout(`Created ${path.join(skillDir, 'SKILL.md')}\n`);
      finalExitCode = 0;
    });

  program
    .command('diff <pathA> <pathB>')
    .description('Compare diagnostics between two skill directories')
    .action(async (pathA: string, pathB: string) => {
      assertLocalOnlyTarget(pathA, 'diff');
      assertLocalOnlyTarget(pathB, 'diff');
      const resultA = await analyze(process.cwd(), pathA, {});
      const resultB = await analyze(process.cwd(), pathB, {});

      const keyFn = (d: Diagnostic) => `${d.ruleId}|${d.message}`;

      const keysA = new Set(resultA.diagnostics.map(keyFn));
      const keysB = new Set(resultB.diagnostics.map(keyFn));

      const onlyA = resultA.diagnostics.filter((d) => !keysB.has(keyFn(d)));
      const onlyB = resultB.diagnostics.filter((d) => !keysA.has(keyFn(d)));
      const shared = resultA.diagnostics.filter((d) => keysB.has(keyFn(d)));

      io.stdout(`${pc.bold('Diff:')} ${pathA} vs ${pathB}\n`);
      io.stdout(`  Only in ${pc.cyan(pathA)}: ${onlyA.length} diagnostic(s)\n`);
      io.stdout(`  Only in ${pc.cyan(pathB)}: ${onlyB.length} diagnostic(s)\n`);
      io.stdout(`  Shared: ${shared.length} diagnostic(s)\n`);

      if (onlyA.length > 0) {
        io.stdout(`\n${pc.bold(`Only in ${pathA}:`)}\n`);
        for (const d of onlyA) {
          io.stdout(
            `  ${d.severity === 'error' ? pc.red('ERR') : pc.yellow('WRN')} ${pc.cyan(d.ruleId)} ${d.message}\n`,
          );
        }
      }
      if (onlyB.length > 0) {
        io.stdout(`\n${pc.bold(`Only in ${pathB}:`)}\n`);
        for (const d of onlyB) {
          io.stdout(
            `  ${d.severity === 'error' ? pc.red('ERR') : pc.yellow('WRN')} ${pc.cyan(d.ruleId)} ${d.message}\n`,
          );
        }
      }

      finalExitCode = 0;
    });

  addSharedOptions(
    program
      .command('watch [target]')
      .description('Watch for changes and re-run validation')
      .action(
        async (
          target: string | undefined,
          rawOptions: Record<string, unknown>,
        ) => {
          assertLocalOnlyTarget(target, 'watch');
          const options = normalizeCliOptions(rawOptions);
          const config = await resolveConfig(process.cwd(), target, options);
          const watchDirs =
            config.rootsAbs.length > 0 ? config.rootsAbs : [config.cwd];

          io.stdout(
            `${pc.cyan('Watching')} ${watchDirs.join(', ')} for changes...\n`,
          );

          const runCheck = async () => {
            try {
              const startedAt = performance.now();
              const result = await analyzeWithConfig(process.cwd(), config);
              const scores = computeSkillScores(
                result.skills,
                result.diagnostics,
              );
              io.stdout(
                `\n${renderText(result, scores, {
                  elapsedMs: performance.now() - startedAt,
                })}`,
              );
            } catch (err) {
              io.stderr(
                `Error: ${err instanceof Error ? err.message : String(err)}\n`,
              );
            }
          };

          await runCheck();

          const watchers: fs.FSWatcher[] = [];
          let debounceTimer: ReturnType<typeof setTimeout> | null = null;

          for (const dir of watchDirs) {
            const watcher = fs.watch(
              dir,
              { recursive: true },
              (_event, filename) => {
                if (!filename || !filename.endsWith('.md')) return;
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  io.stdout(`\n${pc.dim(`Changed: ${filename}`)}\n`);
                  runCheck();
                }, 300);
              },
            );
            watchers.push(watcher);
          }

          await new Promise<void>((resolve) => {
            process.on('SIGINT', () => {
              for (const w of watchers) w.close();
              io.stdout('\nStopped watching.\n');
              resolve();
            });
          });

          finalExitCode = 0;
        },
      ),
  );

  program
    .command('init [target]')
    .description('Create skill-check.config.json template')
    .option('--force', 'Overwrite existing config file')
    .option('--interactive', 'Run interactive setup wizard')
    .action(async (target: string | undefined, options: InitCommandOptions) => {
      if (options.interactive) {
        finalExitCode = await runInteractiveInit(
          process.cwd(),
          target,
          options,
        );
        return;
      }

      const filePath = path.resolve(
        process.cwd(),
        target ?? 'skill-check.config.json',
      );
      ensureInitConfig(filePath, Boolean(options.force));
      io.stdout(`Created ${filePath}\n`);
      finalExitCode = 0;
    });

  try {
    const normalizedArgv = normalizeRootCommandArgs(argv);
    await program.parseAsync(normalizedArgv, { from: 'user' });
    return finalExitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed') {
        return 0;
      }
      io.stderr(`${error.message}\n`);
      return 2;
    }

    if (error instanceof CliError) {
      io.stderr(`${error.message}\n`);
      return error.code;
    }

    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
