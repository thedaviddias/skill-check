export interface ActionInputs {
  path: string;
  cliVersion: string;
  format: string;
  fix: boolean;
  strict: boolean;
  lenient: boolean;
  failOnWarning: boolean;
  configPath: string;
  securityScan: boolean;
  securityScanRunner: string;
  securityScanInstallPolicy: string;
  sarifFile: string;
}

export interface RunActionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runCommand?: (
    spec: string,
    options: { captureStdout: boolean },
  ) => Promise<{ exitCode: number; stdout: string }>;
}

export function parseBooleanInput(
  rawValue: string | undefined,
  name: string,
  fallback: boolean,
): boolean;
export function parseActionInputs(env?: NodeJS.ProcessEnv): ActionInputs;
export function validateActionInputs(inputs: ActionInputs): void;
export function buildSkillCheckArgs(inputs: ActionInputs): string[];
export function buildNpxCommand(inputs: ActionInputs): string;
export function formatCommand(command: string, args: string[]): string;
export function runCommand(
  spec: string,
  options: { captureStdout: boolean },
): Promise<{ exitCode: number; stdout: string }>;
export function runAction(options?: RunActionOptions): Promise<number>;
