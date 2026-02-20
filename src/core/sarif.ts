import type { AnalysisResult } from '../types.js';

export function toSarif(result: AnalysisResult): Record<string, unknown> {
  const rulesMap = new Map<
    string,
    { id: string; shortDescription: { text: string } }
  >();

  for (const diagnostic of result.diagnostics) {
    if (!rulesMap.has(diagnostic.ruleId)) {
      rulesMap.set(diagnostic.ruleId, {
        id: diagnostic.ruleId,
        shortDescription: {
          text: diagnostic.ruleId,
        },
      });
    }
  }

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'skill-check',
            informationUri: 'https://github.com/thedaviddias/skill-check',
            rules: Array.from(rulesMap.values()),
          },
        },
        results: result.diagnostics.map((diagnostic) => ({
          ruleId: diagnostic.ruleId,
          level: diagnostic.severity === 'error' ? 'error' : 'warning',
          message: {
            text: diagnostic.message,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: diagnostic.file,
                },
                region: {
                  startLine: diagnostic.line,
                  startColumn: diagnostic.column,
                },
              },
            },
          ],
        })),
      },
    ],
  };
}
