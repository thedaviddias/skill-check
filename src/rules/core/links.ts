import fs from 'node:fs';
import {
  extractMarkdownLinks,
  isLocalResolvableTarget,
  resolveLocalTarget,
} from '../../core/links.js';
import type { RuleDefinition, RuleFinding } from '../../types.js';

export const linkRules: RuleDefinition[] = [
  {
    id: 'links.local_markdown_resolves',
    description: 'Local markdown links should resolve.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      const links = extractMarkdownLinks(skill.content);
      const findings: RuleFinding[] = [];
      for (const link of links) {
        if (!isLocalResolvableTarget(link.normalizedTarget)) continue;
        if (link.normalizedTarget.startsWith('references/')) continue;
        const target = resolveLocalTarget(
          skill.filePath,
          link.normalizedTarget,
        );
        if (!fs.existsSync(target)) {
          findings.push({
            message: `broken local link: ${link.rawTarget}`,
            suggestion: `Create the file at ${link.normalizedTarget} or fix the link path.`,
            line: link.line,
            column: link.column,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'links.references_resolve',
    description: 'references/* links should resolve within skill directory.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      const links = extractMarkdownLinks(skill.content);
      const findings: RuleFinding[] = [];
      for (const link of links) {
        if (!isLocalResolvableTarget(link.normalizedTarget)) continue;
        if (!link.normalizedTarget.startsWith('references/')) continue;
        const target = resolveLocalTarget(
          skill.filePath,
          link.normalizedTarget,
        );
        if (!fs.existsSync(target)) {
          findings.push({
            message: `broken references link: ${link.rawTarget}`,
            suggestion: `Create ${link.normalizedTarget} in the skill directory or remove the link.`,
            line: link.line,
            column: link.column,
          });
        }
      }
      return findings;
    },
  },
];
