import { minimatch } from 'minimatch';

export function isAllowlisted(skillId: string, allowlist: string[]): boolean {
  return allowlist.some((pattern) => {
    if (pattern === skillId) return true;
    return minimatch(skillId, pattern, { dot: true });
  });
}
