import path from 'node:path';

export interface MarkdownLink {
  rawTarget: string;
  normalizedTarget: string;
  index: number;
  line: number;
  column: number;
}

function findFenceRanges(
  content: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const lines = content.split(/\r?\n/);
  let offset = 0;
  let activeFence: { marker: string; start: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!activeFence) {
        activeFence = { marker, start: offset };
      } else if (activeFence.marker === marker) {
        ranges.push({ start: activeFence.start, end: offset + line.length });
        activeFence = null;
      }
    }
    offset += line.length + 1;
  }

  if (activeFence) {
    ranges.push({ start: activeFence.start, end: content.length });
  }

  return ranges;
}

function inRanges(
  index: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((range) => index >= range.start && index <= range.end);
}

export function getLineColumn(
  content: string,
  index: number,
): { line: number; column: number } {
  const prior = content.slice(0, index);
  const lines = prior.split(/\r?\n/);
  const line = lines.length;
  const column = (lines[lines.length - 1] ?? '').length + 1;
  return { line, column };
}

export function normalizeTarget(rawTarget: string): string {
  let target = rawTarget.trim();
  if (!target) return '';

  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1).trim();
  }

  const titled = target.match(/^(\S+)\s+["'(].*$/);
  if (titled) {
    target = titled[1];
  }

  return target.replace(/^['"]|['"]$/g, '').trim();
}

export function isExternalTarget(target: string): boolean {
  return /^(https?:|mailto:|tel:|data:|javascript:)/i.test(target);
}

export function isLocalResolvableTarget(target: string): boolean {
  if (!target) return false;
  if (target.startsWith('#')) return false;
  if (target.startsWith('/')) return false;
  if (target.includes('{') || target.includes('}')) return false;
  if (isExternalTarget(target)) return false;
  return true;
}

export function stripQueryAndFragment(target: string): string {
  return target.split('#')[0].split('?')[0].trim();
}

export function extractMarkdownLinks(content: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const ranges = findFenceRanges(content);
  const re = /\[[^\]]*\]\(([^)]+)\)/g;

  let match: RegExpExecArray | null = re.exec(content);
  while (match !== null) {
    if (!inRanges(match.index, ranges)) {
      const rawTarget = match[1];
      const normalizedTarget = normalizeTarget(rawTarget);
      const { line, column } = getLineColumn(content, match.index);
      links.push({
        rawTarget,
        normalizedTarget,
        index: match.index,
        line,
        column,
      });
    }
    match = re.exec(content);
  }

  return links;
}

export function resolveLocalTarget(filePath: string, target: string): string {
  const clean = stripQueryAndFragment(target);
  return path.resolve(path.dirname(filePath), clean);
}
