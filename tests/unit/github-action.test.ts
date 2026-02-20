import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSkillCheckArgs,
  parseActionInputs,
  runAction,
  validateActionInputs,
} from '../../github-action/index.js';

function createEnv(values: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...values,
  };
}

function readOutputValue(outputText: string, key: string): string | undefined {
  const pattern = new RegExp(`${key}<<([^\\n]+)\\n([\\s\\S]*?)\\n\\1`, 'm');
  const match = outputText.match(pattern);
  if (!match) return undefined;
  return match[2];
}

describe('github action runtime', () => {
  it('parses boolean and enum inputs', () => {
    const inputs = parseActionInputs(
      createEnv({
        INPUT_PATH: 'fixtures/pass/basic',
        INPUT_CLI_VERSION: '1.2.3',
        INPUT_FORMAT: 'json',
        INPUT_FIX: 'true',
        INPUT_FAIL_ON_WARNING: '1',
        INPUT_SECURITY_SCAN: 'true',
        INPUT_SECURITY_SCAN_RUNNER: 'pipx',
        INPUT_SECURITY_SCAN_INSTALL_POLICY: 'allow',
      }),
    );

    expect(inputs.path).toBe('fixtures/pass/basic');
    expect(inputs.cliVersion).toBe('1.2.3');
    expect(inputs.format).toBe('json');
    expect(inputs.fix).toBe(true);
    expect(inputs.failOnWarning).toBe(true);
    expect(inputs.securityScan).toBe(true);
    expect(inputs.securityScanRunner).toBe('pipx');
    expect(inputs.securityScanInstallPolicy).toBe('allow');
  });

  it('always appends --no-security-scan when security scan is disabled', () => {
    const inputs = parseActionInputs(createEnv({}));
    validateActionInputs(inputs);
    const args = buildSkillCheckArgs(inputs);

    expect(args).toContain('--no-security-scan');
    expect(args).not.toContain('--allow-installs');
    expect(args).not.toContain('--no-installs');
    expect(args).not.toContain('--security-scan-runner');
  });

  it('appends --no-installs when security scan is enabled with deny policy', () => {
    const inputs = parseActionInputs(
      createEnv({
        INPUT_SECURITY_SCAN: 'true',
        INPUT_SECURITY_SCAN_INSTALL_POLICY: 'deny',
      }),
    );
    validateActionInputs(inputs);
    const args = buildSkillCheckArgs(inputs);

    expect(args).toContain('--no-installs');
    expect(args).not.toContain('--allow-installs');
    expect(args).toContain('--security-scan-runner');
  });

  it('appends --allow-installs when security scan is enabled with allow policy', () => {
    const inputs = parseActionInputs(
      createEnv({
        INPUT_SECURITY_SCAN: 'true',
        INPUT_SECURITY_SCAN_INSTALL_POLICY: 'allow',
      }),
    );
    validateActionInputs(inputs);
    const args = buildSkillCheckArgs(inputs);

    expect(args).toContain('--allow-installs');
    expect(args).not.toContain('--no-installs');
  });

  it('fails validation early for invalid combinations', () => {
    const strictAndLenient = parseActionInputs(
      createEnv({
        INPUT_STRICT: 'true',
        INPUT_LENIENT: 'true',
      }),
    );
    expect(() => validateActionInputs(strictAndLenient)).toThrow(
      /strict.*lenient/i,
    );

    const sarifAndScan = parseActionInputs(
      createEnv({
        INPUT_FORMAT: 'sarif',
        INPUT_SECURITY_SCAN: 'true',
      }),
    );
    expect(() => validateActionInputs(sarifAndScan)).toThrow(
      /format=sarif.*security-scan=true/i,
    );

    const invalidPolicy = parseActionInputs(
      createEnv({
        INPUT_SECURITY_SCAN_INSTALL_POLICY: 'maybe',
      }),
    );
    expect(() => validateActionInputs(invalidPolicy)).toThrow(
      /security-scan-install-policy/i,
    );
  });

  it('writes SARIF output and publishes sarif-file output when format=sarif', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-check-gha-'));
    const outputPath = path.join(tempDir, 'github-output.txt');
    let observedCaptureStdout = false;

    const code = await runAction({
      cwd: tempDir,
      env: createEnv({
        INPUT_FORMAT: 'sarif',
        INPUT_PATH: '.',
        INPUT_SECURITY_SCAN: 'false',
        INPUT_SARIF_FILE: 'artifacts/skill-check.sarif.json',
        GITHUB_OUTPUT: outputPath,
      }),
      runCommand: async (_spec, options) => {
        observedCaptureStdout = options.captureStdout;
        return {
          exitCode: 1,
          stdout: '{"version":"2.1.0","runs":[]}\n',
        };
      },
    });

    expect(code).toBe(1);
    expect(observedCaptureStdout).toBe(true);

    const expectedSarifPath = path.resolve(
      tempDir,
      'artifacts/skill-check.sarif.json',
    );
    expect(fs.existsSync(expectedSarifPath)).toBe(true);
    expect(fs.readFileSync(expectedSarifPath, 'utf8')).toContain('"runs":[]');

    const outputText = fs.readFileSync(outputPath, 'utf8');
    expect(readOutputValue(outputText, 'exit-code')).toBe('1');
    expect(readOutputValue(outputText, 'sarif-file')).toBe(expectedSarifPath);
    expect(readOutputValue(outputText, 'command')).toContain(
      'npx --yes skill-check@latest check . --format sarif --no-security-scan',
    );
  });
});
