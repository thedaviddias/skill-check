import type { Diagnostic, SkillArtifact } from '../types.js';

export interface SkillScore {
  skillId: string;
  relativePath: string;
  score: number;
  breakdown: {
    frontmatter: number;
    description: number;
    body: number;
    links: number;
    file: number;
  };
}

const CATEGORY_WEIGHTS = {
  frontmatter: 30,
  description: 30,
  body: 20,
  links: 10,
  file: 10,
};

function categorize(ruleId: string): keyof typeof CATEGORY_WEIGHTS {
  if (ruleId.startsWith('frontmatter.')) return 'frontmatter';
  if (ruleId.startsWith('description.')) return 'description';
  if (ruleId.startsWith('body.')) return 'body';
  if (ruleId.startsWith('links.')) return 'links';
  return 'file';
}

export function computeSkillScores(
  skills: SkillArtifact[],
  diagnostics: Diagnostic[],
): SkillScore[] {
  const diagnosticsByFile = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = diagnosticsByFile.get(d.file) ?? [];
    list.push(d);
    diagnosticsByFile.set(d.file, list);
  }

  return skills.map((skill) => {
    const fileDiagnostics = diagnosticsByFile.get(skill.relativePath) ?? [];
    const penalties: Record<keyof typeof CATEGORY_WEIGHTS, number> = {
      frontmatter: 0,
      description: 0,
      body: 0,
      links: 0,
      file: 0,
    };

    for (const d of fileDiagnostics) {
      const cat = categorize(d.ruleId);
      const penalty = d.severity === 'error' ? 1 : 0.5;
      penalties[cat] += penalty;
    }

    const breakdown = {} as SkillScore['breakdown'];
    let total = 0;
    for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
      const key = cat as keyof typeof CATEGORY_WEIGHTS;
      const raw = Math.max(0, weight - penalties[key] * weight);
      breakdown[key] = Math.round(raw);
      total += breakdown[key];
    }

    return {
      skillId: skill.id,
      relativePath: skill.relativePath,
      score: Math.min(100, Math.max(0, total)),
      breakdown,
    };
  });
}
