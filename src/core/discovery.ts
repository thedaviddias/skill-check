import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type { ResolvedConfig } from '../types.js';

export async function discoverSkillFiles(
  config: ResolvedConfig,
): Promise<string[]> {
  const found = new Set<string>();

  for (const root of config.rootsAbs) {
    if (fs.existsSync(root) && fs.statSync(root).isFile()) {
      if (path.basename(root) === 'SKILL.md') {
        found.add(path.resolve(root));
      }
      continue;
    }

    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      continue;
    }

    const matches = await fg(config.include, {
      cwd: root,
      ignore: config.exclude,
      absolute: true,
      onlyFiles: true,
      dot: true,
    });

    for (const match of matches) {
      found.add(path.resolve(match));
    }
  }

  return Array.from(found).sort();
}
