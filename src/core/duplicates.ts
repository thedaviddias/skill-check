import type { Diagnostic, SkillArtifact } from '../types.js';

export function detectDuplicates(skills: SkillArtifact[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const nameMap = new Map<string, SkillArtifact[]>();
  for (const skill of skills) {
    if (!skill.frontmatter?.name) continue;
    const name = String(skill.frontmatter.name);
    const list = nameMap.get(name) ?? [];
    list.push(skill);
    nameMap.set(name, list);
  }

  for (const [name, group] of nameMap) {
    if (group.length <= 1) continue;
    for (const skill of group) {
      diagnostics.push({
        ruleId: 'duplicates.name',
        severity: 'warn',
        message: `duplicate skill name "${name}" shared with: ${group
          .filter((s) => s !== skill)
          .map((s) => s.relativePath)
          .join(', ')}`,
        suggestion: 'Ensure each skill has a unique name.',
        file: skill.relativePath,
        line: 1,
        column: 1,
      });
    }
  }

  const descMap = new Map<string, SkillArtifact[]>();
  for (const skill of skills) {
    if (!skill.frontmatter?.description) continue;
    const desc = String(skill.frontmatter.description).trim().toLowerCase();
    if (desc.length < 20) continue;
    const list = descMap.get(desc) ?? [];
    list.push(skill);
    descMap.set(desc, list);
  }

  for (const [, group] of descMap) {
    if (group.length <= 1) continue;
    for (const skill of group) {
      diagnostics.push({
        ruleId: 'duplicates.description',
        severity: 'warn',
        message: `identical description shared with: ${group
          .filter((s) => s !== skill)
          .map((s) => s.relativePath)
          .join(', ')}`,
        suggestion:
          'Write distinct descriptions so agents can differentiate skills.',
        file: skill.relativePath,
        line: 1,
        column: 1,
      });
    }
  }

  return diagnostics;
}
