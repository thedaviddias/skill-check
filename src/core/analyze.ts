import fs from 'node:fs';
import path from 'node:path';
import { coreRules } from '../rules/core/index.js';
import type {
  AnalysisResult,
  CliOptions,
  ResolvedConfig,
  RuleDefinition,
} from '../types.js';
import { buildSkillArtifact } from './artifact.js';
import { resolveConfig } from './config.js';
import { discoverSkillFiles } from './discovery.js';
import { CliError } from './errors.js';
import { loadPluginRules } from './plugins.js';
import { runRuleEngine } from './rule-engine.js';

function summarize(
  skillCount: number,
  diagnostics: AnalysisResult['diagnostics'],
) {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warn').length;
  return { skillCount, errorCount, warningCount };
}

export async function analyze(
  cwd: string,
  targetPath: string | undefined,
  cliOptions: CliOptions,
): Promise<AnalysisResult> {
  const config = await resolveConfig(cwd, targetPath, cliOptions);
  return analyzeWithConfig(cwd, config);
}

export async function analyzeWithConfig(
  cwd: string,
  config: ResolvedConfig,
): Promise<AnalysisResult> {
  const files = await discoverSkillFiles(config);

  const skills = files.map((file) => buildSkillArtifact(file, cwd));

  const pluginRules = await loadPluginRules(config);
  const rules: RuleDefinition[] = [...coreRules, ...pluginRules];

  const diagnostics = await runRuleEngine(skills, rules, config);

  return {
    config,
    skills,
    diagnostics,
    summary: summarize(skills.length, diagnostics),
  };
}

export function resolveExitCode(result: AnalysisResult): number {
  if (result.summary.errorCount > 0) return 1;
  if (result.config.failOnWarning && result.summary.warningCount > 0) return 1;
  return 0;
}

export function writeIfRequested(
  config: ResolvedConfig,
  text: string,
): string | undefined {
  const reportPath = config.output.reportPath;
  if (!reportPath) return undefined;

  const parent = path.dirname(reportPath);
  fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(reportPath, text);
  return reportPath;
}

export function ensureInitConfig(targetPath: string, force = false): void {
  if (fs.existsSync(targetPath) && !force) {
    throw new CliError(
      `Config file already exists: ${targetPath}. Use --force to overwrite.`,
      2,
    );
  }

  const template = {
    roots: ['.'],
    include: ['**/skills/*/SKILL.md'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    limits: {
      maxDescriptionChars: 1024,
      maxBodyLines: 500,
      minDescriptionChars: 50,
      maxBodyTokens: 5000,
    },
    rules: {
      'description.use_when_phrase': 'warn',
    },
    allowlist: [],
    plugins: [],
    output: {
      format: 'text',
    },
  };

  fs.writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`);
}
