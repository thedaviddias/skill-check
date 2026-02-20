import { confirm as clackConfirm, isCancel } from '@clack/prompts';
import type { AnalysisResult, Diagnostic } from '../types.js';
import { type AutoFixSummary, isFixableRuleId } from './fix.js';

export interface InteractiveFixResult extends AutoFixSummary {
  skippedByUser: number;
}

export async function selectFixableDiagnostics(
  result: AnalysisResult,
): Promise<{ accepted: Diagnostic[]; skipped: number }> {
  const fixable = result.diagnostics.filter((d) => isFixableRuleId(d.ruleId));
  const accepted: Diagnostic[] = [];
  let skipped = 0;

  for (const d of fixable) {
    const answer = await clackConfirm({
      message: `Fix ${d.ruleId} in ${d.file}:${d.line} — ${d.message}?`,
      initialValue: true,
    });
    if (isCancel(answer)) break;
    if (answer) {
      accepted.push(d);
    } else {
      skipped += 1;
    }
  }

  return { accepted, skipped };
}
