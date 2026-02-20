import fs from 'node:fs';
import YAML from 'yaml';
import type { AnalysisResult, SkillArtifact } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';

const DESCRIPTION_PADDING =
  ' Include clear triggers, constraints, and expected outcomes.';

const FRONTMATTER_FIXABLE_RULE_IDS = new Set([
  'frontmatter.required',
  'frontmatter.name_required',
  'frontmatter.description_required',
  'frontmatter.name_matches_directory',
  'frontmatter.name_slug_format',
  'frontmatter.field_order',
  'description.use_when_phrase',
  'description.min_recommended_length',
]);

const FIXABLE_RULE_IDS = new Set([
  ...FRONTMATTER_FIXABLE_RULE_IDS,
  'file.trailing_newline_single',
]);

export interface AutoFixSummary {
  requestedDiagnostics: number;
  supportedDiagnostics: number;
  unsupportedDiagnostics: number;
  appliedFixes: number;
  filesUpdated: number;
  updatedFiles: string[];
}

function normalizeTrailingNewline(content: string): string {
  const withoutTrailingBreaks = content.replace(/(?:\r?\n)+$/u, '');
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  return `${withoutTrailingBreaks}${lineEnding}`;
}

function ensureUseWhenPhrase(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return trimmed;
  if (/\buse\s+when\b/i.test(trimmed)) return trimmed;

  const first = trimmed[0];
  if (!first) return `Use when ${trimmed}`;
  return `Use when ${first.toLowerCase()}${trimmed.slice(1)}`;
}

function ensureMinDescriptionLength(description: string, minLength: number) {
  let value = description.trim();
  while (value.length < minLength) {
    value = `${value}${DESCRIPTION_PADDING}`;
  }
  return value;
}

function defaultDescription(slug: string): string {
  return `Use when ${slug} should be selected for a task based on explicit user intent and clear context.`;
}

function orderFrontmatter(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  if (Object.hasOwn(frontmatter, 'name')) {
    ordered.name = frontmatter.name;
  }
  if (Object.hasOwn(frontmatter, 'description')) {
    ordered.description = frontmatter.description;
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'name' || key === 'description') continue;
    ordered[key] = value;
  }
  return ordered;
}

function renderFrontmatterContent(
  frontmatter: Record<string, unknown>,
  body: string,
  lineEnding: string,
): string {
  const yamlBlock = YAML.stringify(frontmatter)
    .trimEnd()
    .replace(/\n/g, lineEnding);
  const normalizedBody =
    body.length > 0 && !body.startsWith('\n') && !body.startsWith('\r\n')
      ? `${lineEnding}${body}`
      : body;
  return `---${lineEnding}${yamlBlock}${lineEnding}---${lineEnding}${normalizedBody}`;
}

export function isFixableRuleId(ruleId: string): boolean {
  return FIXABLE_RULE_IDS.has(ruleId);
}

function applyFixesForSkill(
  skill: SkillArtifact,
  ruleIds: Set<string>,
  minDescriptionChars: number,
): string[] {
  if (ruleIds.size === 0) return [];

  let content = fs.readFileSync(skill.filePath, 'utf8');
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const appliedRuleIds = new Set<string>();

  const needsFrontmatterFix = Array.from(ruleIds).some((ruleId) =>
    FRONTMATTER_FIXABLE_RULE_IDS.has(ruleId),
  );

  if (needsFrontmatterFix) {
    const parsed = parseFrontmatter(content);
    const hasValidFrontmatter = Boolean(parsed.frontmatter);
    const frontmatter = parsed.frontmatter ? { ...parsed.frontmatter } : {};
    const body = parsed.body;

    if (
      ruleIds.has('frontmatter.required') ||
      ruleIds.has('frontmatter.name_required') ||
      ruleIds.has('frontmatter.name_matches_directory') ||
      ruleIds.has('frontmatter.name_slug_format') ||
      (!hasValidFrontmatter && !frontmatter.name)
    ) {
      frontmatter.name = skill.slug;
    }

    const shouldEnsureDescription =
      ruleIds.has('frontmatter.required') ||
      ruleIds.has('frontmatter.description_required') ||
      ruleIds.has('description.use_when_phrase') ||
      ruleIds.has('description.min_recommended_length') ||
      !frontmatter.description;
    if (shouldEnsureDescription) {
      let description =
        typeof frontmatter.description === 'string'
          ? frontmatter.description.trim()
          : '';
      if (!description) {
        description = defaultDescription(skill.slug);
      }
      if (ruleIds.has('description.use_when_phrase')) {
        description = ensureUseWhenPhrase(description);
      }
      if (ruleIds.has('description.min_recommended_length')) {
        description = ensureMinDescriptionLength(
          description,
          minDescriptionChars,
        );
      }
      frontmatter.description = description;
    }

    const orderedFrontmatter = orderFrontmatter(frontmatter);
    const rewritten = renderFrontmatterContent(
      orderedFrontmatter,
      body,
      lineEnding,
    );
    if (rewritten !== content) {
      content = rewritten;
      for (const ruleId of ruleIds) {
        if (FRONTMATTER_FIXABLE_RULE_IDS.has(ruleId)) {
          appliedRuleIds.add(ruleId);
        }
      }
    }
  }

  if (ruleIds.has('file.trailing_newline_single')) {
    const normalized = normalizeTrailingNewline(content);
    if (normalized !== content) {
      content = normalized;
      appliedRuleIds.add('file.trailing_newline_single');
    }
  }

  if (appliedRuleIds.size > 0) {
    fs.writeFileSync(skill.filePath, content, 'utf8');
  }

  return Array.from(appliedRuleIds);
}

export function applyAutoFixes(result: AnalysisResult): AutoFixSummary {
  const rulesByFile = new Map<string, Set<string>>();
  const skillByRelativePath = new Map(
    result.skills.map((skill) => [skill.relativePath, skill]),
  );

  let supportedDiagnostics = 0;
  let unsupportedDiagnostics = 0;

  for (const diagnostic of result.diagnostics) {
    if (!isFixableRuleId(diagnostic.ruleId)) {
      unsupportedDiagnostics += 1;
      continue;
    }

    supportedDiagnostics += 1;

    const skill = skillByRelativePath.get(diagnostic.file);
    if (!skill) continue;
    const existing = rulesByFile.get(diagnostic.file) ?? new Set<string>();
    existing.add(diagnostic.ruleId);
    rulesByFile.set(diagnostic.file, existing);
  }

  let appliedFixes = 0;
  const updatedFiles: string[] = [];

  for (const [relativePath, ruleIds] of rulesByFile) {
    const skill = skillByRelativePath.get(relativePath);
    if (!skill) continue;
    const applied = applyFixesForSkill(
      skill,
      ruleIds,
      result.config.limits.minDescriptionChars,
    );
    if (applied.length === 0) continue;
    appliedFixes += applied.length;
    updatedFiles.push(relativePath);
  }

  return {
    requestedDiagnostics: result.diagnostics.length,
    supportedDiagnostics,
    unsupportedDiagnostics,
    appliedFixes,
    filesUpdated: updatedFiles.length,
    updatedFiles,
  };
}
