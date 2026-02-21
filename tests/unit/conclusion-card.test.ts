import { describe, expect, it } from 'vitest';
import { renderConclusionCard } from '../../src/core/conclusion-card.js';

const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g');

function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '');
}

describe('renderConclusionCard', () => {
  it('renders validation/security state and summary counts', () => {
    const output = stripAnsi(
      renderConclusionCard({
        skillCount: 3,
        errorCount: 0,
        warningCount: 1,
        affectedFileCount: 2,
        overallScore: 87,
        validationStatus: 'WARN',
        securityStatus: 'PASS',
        elapsedMs: 1534,
      }).card,
    );

    expect(output).toContain('skill-check cli');
    expect(output).toContain('87 / 100  Solid');
    expect(output).toContain('validation WARN | security PASS');
    expect(output).toContain('✖ 0 errors');
    expect(output).toContain('⚠ 1 warning');
    expect(output).toContain('3 skills');
    expect(output).toContain('across 2 files');
    expect(output).toContain('in 1.5s');
  });

  it('maps score thresholds to labels', () => {
    const excellent = stripAnsi(
      renderConclusionCard({
        skillCount: 1,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
        overallScore: 90,
        validationStatus: 'PASS',
        securityStatus: 'SKIPPED',
        elapsedMs: 200,
      }).card,
    );
    const solid = stripAnsi(
      renderConclusionCard({
        skillCount: 1,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
        overallScore: 75,
        validationStatus: 'PASS',
        securityStatus: 'SKIPPED',
        elapsedMs: 200,
      }).card,
    );
    const needsWork = stripAnsi(
      renderConclusionCard({
        skillCount: 1,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
        overallScore: 50,
        validationStatus: 'PASS',
        securityStatus: 'SKIPPED',
        elapsedMs: 200,
      }).card,
    );
    const critical = stripAnsi(
      renderConclusionCard({
        skillCount: 1,
        errorCount: 1,
        warningCount: 0,
        affectedFileCount: 1,
        overallScore: 49,
        validationStatus: 'FAIL',
        securityStatus: 'FAIL',
        elapsedMs: 200,
      }).card,
    );

    expect(excellent).toContain('90 / 100  Excellent');
    expect(solid).toContain('75 / 100  Solid');
    expect(needsWork).toContain('50 / 100  Needs work');
    expect(critical).toContain('49 / 100  Critical');
  });

  it('renders no-skills fallback', () => {
    const output = stripAnsi(
      renderConclusionCard({
        skillCount: 0,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
        overallScore: null,
        validationStatus: 'PASS',
        securityStatus: 'SKIPPED',
        elapsedMs: 0,
      }).card,
    );

    expect(output).toContain('-- / 100  No skills');
  });

  it('keeps frame width stable after stripping ANSI', () => {
    const output = stripAnsi(
      renderConclusionCard({
        skillCount: 2,
        errorCount: 3,
        warningCount: 4,
        affectedFileCount: 2,
        overallScore: 42,
        validationStatus: 'FAIL',
        securityStatus: 'SKIPPED',
        elapsedMs: 812,
      }).card,
    );
    const lines = output.split('\n');
    const widths = lines.map((line) => line.length);
    const expected = widths[0];

    for (const width of widths) {
      expect(width).toBe(expected);
    }
  });

  it('shows run command preview when provided', () => {
    const output = stripAnsi(
      renderConclusionCard({
        skillCount: 1,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
        overallScore: 100,
        validationStatus: 'PASS',
        securityStatus: 'PASS',
        elapsedMs: 400,
        runCommand: 'npx skill-check check . --no-security-scan',
      }).card,
    );

    expect(output).toContain('run: npx skill-check check . --no-security-scan');
  });

  it('returns full command when run command preview is truncated', () => {
    const longCommand =
      'npx skill-check check https://github.com/acme/really-long-repository-name/tree/main/some/really/long/path/for/skills --no-security-scan';

    const rendered = renderConclusionCard({
      skillCount: 1,
      errorCount: 0,
      warningCount: 0,
      affectedFileCount: 0,
      overallScore: 100,
      validationStatus: 'PASS',
      securityStatus: 'PASS',
      elapsedMs: 400,
      runCommand: longCommand,
    });

    const output = stripAnsi(rendered.card);
    expect(output).toContain('full command below');
    expect(output).toContain('run:');
    expect(output).toContain('…');
    expect(rendered.fullCommandPlain).toBe(longCommand);
  });
});
