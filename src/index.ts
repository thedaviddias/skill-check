export { analyze, resolveExitCode } from './core/analyze.js';
export type { BaselineDiff } from './core/baseline.js';
export { diffBaseline, loadBaseline } from './core/baseline.js';
export { resolveConfig } from './core/config.js';
export { detectDuplicates } from './core/duplicates.js';
export { toGitHubAnnotations } from './core/github-formatter.js';
export { renderHtml } from './core/html-report.js';
export type { SkillScore } from './core/quality-score.js';
export { computeSkillScores } from './core/quality-score.js';
export { coreRules } from './rules/core/index.js';
export type {
  AnalysisResult,
  CliOptions,
  Diagnostic,
  PluginModule,
  ResolvedConfig,
  RuleDefinition,
  RuleFinding,
  Severity,
  SkillArtifact,
} from './types.js';
