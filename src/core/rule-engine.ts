import type {
  Diagnostic,
  ResolvedConfig,
  RuleContext,
  RuleDefinition,
  RuleLevel,
  SkillArtifact,
} from '../types.js';
import { isAllowlisted } from './allowlist.js';

function resolveRuleLevel(
  config: ResolvedConfig,
  ruleId: string,
  fallback: RuleLevel,
): RuleLevel {
  const override = config.rules[ruleId];
  if (override) return override;
  return fallback;
}

export async function runRuleEngine(
  skills: SkillArtifact[],
  rules: RuleDefinition[],
  config: ResolvedConfig,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  const context: RuleContext = {
    config,
    resolveRuleLevel: (ruleId, fallback) =>
      resolveRuleLevel(config, ruleId, fallback),
  };

  for (const skill of skills) {
    for (const rule of rules) {
      const level = resolveRuleLevel(config, rule.id, rule.defaultSeverity);
      if (level === 'off') continue;

      const findings = await rule.evaluate(skill, context);
      if (!findings || findings.length === 0) continue;

      for (const finding of findings) {
        if (isAllowlisted(skill.id, config.allowlist)) {
          continue;
        }

        let severity =
          finding.severity ?? (level === 'error' ? 'error' : 'warn');
        if (config.strictMode && severity === 'warn') {
          severity = 'error';
        }

        diagnostics.push({
          ruleId: rule.id,
          severity,
          message: finding.message,
          file: skill.relativePath,
          line: finding.line ?? 1,
          column: finding.column ?? 1,
          suggestion: finding.suggestion,
        });
      }
    }
  }

  diagnostics.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return diagnostics;
}
