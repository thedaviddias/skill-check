import type { RuleDefinition } from '../../types.js';
import { bodyRules } from './body.js';
import { descriptionRules } from './description.js';
import { fileRules } from './file.js';
import { frontmatterRules } from './frontmatter.js';
import { linkRules } from './links.js';

export const coreRules: RuleDefinition[] = [
  ...frontmatterRules,
  ...descriptionRules,
  ...bodyRules,
  ...fileRules,
  ...linkRules,
];
