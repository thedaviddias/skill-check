import type { RuleDefinition } from '../../types.js';

export const fileRules: RuleDefinition[] = [
  {
    id: 'file.trailing_newline_single',
    description: 'File should end with exactly one trailing newline.',
    defaultSeverity: 'warn',
    evaluate(skill) {
      if (!skill.content.endsWith('\n')) {
        return [
          {
            message: 'file should end with a newline',
            suggestion: 'Add a single newline at the end of the file.',
          },
        ];
      }
      if (skill.content.endsWith('\n\n')) {
        return [
          {
            message:
              'file has multiple trailing newlines; use a single newline',
            suggestion: 'Remove extra blank lines at the end of the file.',
          },
        ];
      }
      return [];
    },
  },
];
