import fs from 'node:fs';
import path from 'node:path';
import type { SkillArtifact } from '../types.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const H2_RE = /^##\s+(.+?)\s*$/;

export interface SourceLineRange {
  startLine: number;
  endLine: number;
}

export interface SplitReferencePlan {
  relativePath: string;
  title: string;
  content: string;
  sourceLineRange: SourceLineRange;
}

export interface SplitPlan {
  skillFilePath: string;
  skillRelativePath: string;
  beforeLineCount: number;
  afterLineCount: number;
  referencesToCreate: SplitReferencePlan[];
  newSkillBody: string;
  newSkillContent: string;
  status: 'noop' | 'planned' | 'blocked';
  reason?: string;
}

interface PlanBodySplitDeps {
  pathExists?: (targetPath: string) => boolean;
}

interface BodySection {
  title: string;
  startIndex: number;
  endIndex: number;
}

function countLines(text: string): number {
  return text.split(/\r?\n/).length;
}

function trimEmptyEdges(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start]?.trim() === '') {
    start += 1;
  }

  let end = lines.length - 1;
  while (end >= start && lines[end]?.trim() === '') {
    end -= 1;
  }

  return lines.slice(start, end + 1);
}

function toSlug(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

function normalizeLineEnding(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function parseSections(body: string): BodySection[] {
  const lines = body.split(/\r?\n/);
  const indexes: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (H2_RE.test(lines[i] ?? '')) {
      indexes.push(i);
    }
  }

  const sections: BodySection[] = [];
  for (let i = 0; i < indexes.length; i += 1) {
    const startIndex = indexes[i] ?? 0;
    const endIndex = (indexes[i + 1] ?? lines.length) - 1;
    const heading = lines[startIndex] ?? '';
    const title = heading.replace(H2_RE, '$1').trim();
    sections.push({ title: title || 'Section', startIndex, endIndex });
  }
  return sections;
}

function buildReferenceContent(
  title: string,
  sectionLines: string[],
  lineEnding: '\n' | '\r\n',
): string {
  const trimmed = trimEmptyEdges(sectionLines);
  if (trimmed.length === 0) {
    return `# ${title}${lineEnding}`;
  }

  return `# ${title}${lineEnding}${lineEnding}${trimmed.join(lineEnding)}${lineEnding}`;
}

function buildNewBody(
  introLines: string[],
  references: SplitReferencePlan[],
  lineEnding: '\n' | '\r\n',
): string {
  const blocks: string[] = [];
  const intro = trimEmptyEdges(introLines).join(lineEnding);
  if (intro) {
    blocks.push(intro);
  }

  const referenceLines = [
    '## References',
    '',
    'This skill content is modularized into reference docs for readability.',
    '',
    ...references.map(
      (entry) =>
        `- [${entry.title}](${entry.relativePath}) - extracted from SKILL body`,
    ),
  ];
  blocks.push(referenceLines.join(lineEnding));

  return `${blocks.join(`${lineEnding}${lineEnding}`)}${lineEnding}`;
}

function replaceBody(content: string, newBody: string): string {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return newBody;
  }
  return `${match[0]}${newBody}`;
}

function resolveBodyStartLine(content: string): number {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return 1;
  return match[0].split(/\r?\n/).length;
}

function allocateReferencePath(
  skillDir: string,
  baseSlug: string,
  usedPaths: Set<string>,
  pathExists: (targetPath: string) => boolean,
): string {
  let index = 1;
  while (true) {
    const suffix = index === 1 ? '' : `-${index}`;
    const relativePath = path.posix.join(
      'references',
      `${baseSlug}${suffix}.md`,
    );
    if (!usedPaths.has(relativePath)) {
      const absolutePath = path.join(skillDir, ...relativePath.split('/'));
      if (!pathExists(absolutePath)) {
        usedPaths.add(relativePath);
        return relativePath;
      }
    }
    index += 1;
  }
}

export function planBodySplit(
  skill: SkillArtifact,
  maxBodyLines: number,
  deps: PlanBodySplitDeps = {},
): SplitPlan {
  const beforeLineCount = countLines(skill.body);
  const lineEnding = normalizeLineEnding(skill.content);
  const noopResult: SplitPlan = {
    skillFilePath: skill.filePath,
    skillRelativePath: skill.relativePath,
    beforeLineCount,
    afterLineCount: beforeLineCount,
    referencesToCreate: [],
    newSkillBody: skill.body,
    newSkillContent: skill.content,
    status: 'noop',
    reason: `Body is within limit (${beforeLineCount} <= ${maxBodyLines}).`,
  };

  if (beforeLineCount <= maxBodyLines) {
    return noopResult;
  }

  const sections = parseSections(skill.body);
  if (sections.length === 0) {
    return {
      ...noopResult,
      status: 'blocked',
      reason: 'Add at least one ## section heading before automatic split.',
    };
  }

  const pathExists =
    deps.pathExists ?? ((targetPath: string) => fs.existsSync(targetPath));
  const skillDir = path.dirname(skill.filePath);
  const bodyLines = skill.body.split(/\r?\n/);
  const bodyStartLine = resolveBodyStartLine(skill.content);
  const introLines = bodyLines.slice(0, sections[0]?.startIndex ?? 0);
  const usedReferencePaths = new Set<string>();

  const referencesToCreate: SplitReferencePlan[] = sections.map((section) => {
    const baseSlug = toSlug(section.title);
    const relativePath = allocateReferencePath(
      skillDir,
      baseSlug,
      usedReferencePaths,
      pathExists,
    );
    const sectionLines = bodyLines.slice(
      section.startIndex + 1,
      section.endIndex + 1,
    );
    return {
      relativePath,
      title: section.title,
      content: buildReferenceContent(section.title, sectionLines, lineEnding),
      sourceLineRange: {
        startLine: bodyStartLine + section.startIndex,
        endLine: bodyStartLine + section.endIndex,
      },
    };
  });

  const newSkillBody = buildNewBody(introLines, referencesToCreate, lineEnding);
  const newSkillContent = replaceBody(skill.content, newSkillBody);
  const afterLineCount = countLines(newSkillBody);

  return {
    skillFilePath: skill.filePath,
    skillRelativePath: skill.relativePath,
    beforeLineCount,
    afterLineCount,
    referencesToCreate,
    newSkillBody,
    newSkillContent,
    status: 'planned',
    reason:
      afterLineCount > maxBodyLines
        ? `Split completed but body still exceeds limit (${afterLineCount} > ${maxBodyLines}).`
        : undefined,
  };
}

export function applyBodySplitPlan(plan: SplitPlan): {
  updatedSkill: boolean;
  writtenReferenceFiles: string[];
} {
  if (plan.status !== 'planned') {
    return { updatedSkill: false, writtenReferenceFiles: [] };
  }

  fs.writeFileSync(plan.skillFilePath, plan.newSkillContent, 'utf8');
  const skillDir = path.dirname(plan.skillFilePath);
  const writtenReferenceFiles: string[] = [];

  for (const reference of plan.referencesToCreate) {
    const absolutePath = path.join(
      skillDir,
      ...reference.relativePath.split('/'),
    );
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, reference.content, 'utf8');
    writtenReferenceFiles.push(absolutePath);
  }

  return {
    updatedSkill: true,
    writtenReferenceFiles,
  };
}
