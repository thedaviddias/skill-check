import fs from 'node:fs';
import path from 'node:path';
import type { SkillArtifact } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';

function deriveCategoryAndSlug(filePath: string): {
  category: string;
  slug: string;
} {
  const parts = path.resolve(filePath).split(path.sep).filter(Boolean);
  const skillsIndex = parts.lastIndexOf('skills');

  if (skillsIndex > 0 && skillsIndex + 1 < parts.length) {
    const category = parts[skillsIndex - 1] ?? 'unknown';
    const slug = parts[skillsIndex + 1] ?? 'unknown-skill';
    return { category, slug };
  }

  const slug = path.basename(path.dirname(filePath));
  const category = path.basename(path.dirname(path.dirname(filePath)));
  return { category, slug };
}

export function buildSkillArtifact(
  filePath: string,
  cwd: string,
): SkillArtifact {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  const { category, slug } = deriveCategoryAndSlug(filePath);
  const id = `${category}/${slug}`;

  return {
    id,
    category,
    slug,
    filePath: path.resolve(filePath),
    relativePath: path.relative(cwd, path.resolve(filePath)),
    content,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    frontmatterRaw: parsed.frontmatterRaw,
    parseError: parsed.error,
  };
}
