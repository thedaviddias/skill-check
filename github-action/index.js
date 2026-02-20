#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_FORMATS = new Set(['text', 'json', 'sarif']);
const VALID_SECURITY_SCAN_RUNNERS = new Set(['auto', 'local', 'uvx', 'pipx']);
const VALID_INSTALL_POLICIES = new Set(['allow', 'deny']);

function normalizeInputName(name) {
  return `INPUT_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function readInput(env, name, fallback = '') {
  const key = normalizeInputName(name);
  const value = env[key];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

export function parseBooleanInput(rawValue, name, fallback) {
  if (rawValue === '') return fallback;

  const normalized = String(rawValue).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  throw new Error(
    `Invalid input "${name}" value "${rawValue}". Use true or false.`,
  );
}

export function parseActionInputs(env = process.env) {
  const pathInput = readInput(env, 'path', '.');
  const cliVersion = readInput(env, 'cli-version', 'latest');
  const format = readInput(env, 'format', 'text').toLowerCase();
  const runner = readInput(env, 'security-scan-runner', 'auto').toLowerCase();
  const installPolicy = readInput(
    env,
    'security-scan-install-policy',
    'deny',
  ).toLowerCase();

  return {
    path: pathInput || '.',
    cliVersion: cliVersion || 'latest',
    config: readInput(env, 'config'),
    format,
    fix: parseBooleanInput(readInput(env, 'fix'), 'fix', false),
    failOnWarning: parseBooleanInput(
      readInput(env, 'fail-on-warning'),
      'fail-on-warning',
      false,
    ),
    strict: parseBooleanInput(readInput(env, 'strict'), 'strict', false),
    lenient: parseBooleanInput(readInput(env, 'lenient'), 'lenient', false),
    securityScan: parseBooleanInput(
      readInput(env, 'security-scan'),
      'security-scan',
      false,
    ),
    securityScanRunner: runner,
    securityScanInstallPolicy: installPolicy,
    securityScanPaths: readInput(env, 'security-scan-paths'),
    securityScanSkills: readInput(env, 'security-scan-skills'),
    sarifFile: readInput(env, 'sarif-file', 'skill-check.sarif.json'),
  };
}

export function validateActionInputs(inputs) {
  if (!VALID_FORMATS.has(inputs.format)) {
    throw new Error(
      `Invalid input "format" value "${inputs.format}". Use text|json|sarif.`,
    );
  }

  if (inputs.strict && inputs.lenient) {
    throw new Error(
      'Invalid inputs: "strict" and "lenient" cannot both be true.',
    );
  }

  if (!VALID_SECURITY_SCAN_RUNNERS.has(inputs.securityScanRunner)) {
    throw new Error(
      `Invalid input "security-scan-runner" value "${inputs.securityScanRunner}". Use auto|local|uvx|pipx.`,
    );
  }

  if (!VALID_INSTALL_POLICIES.has(inputs.securityScanInstallPolicy)) {
    throw new Error(
      `Invalid input "security-scan-install-policy" value "${inputs.securityScanInstallPolicy}". Use allow|deny.`,
    );
  }

  if (inputs.format === 'sarif' && inputs.securityScan) {
    throw new Error(
      'Invalid inputs: format=sarif cannot be used with security-scan=true.',
    );
  }
}

export function buildSkillCheckArgs(inputs) {
  const args = ['check', inputs.path, '--format', inputs.format];

  if (inputs.config) {
    args.push('--config', inputs.config);
  }
  if (inputs.fix) {
    args.push('--fix');
  }
  if (inputs.failOnWarning) {
    args.push('--fail-on-warning');
  }
  if (inputs.strict) {
    args.push('--strict');
  }
  if (inputs.lenient) {
    args.push('--lenient');
  }

  if (!inputs.securityScan) {
    args.push('--no-security-scan');
    return args;
  }

  args.push('--security-scan-runner', inputs.securityScanRunner);
  args.push(
    inputs.securityScanInstallPolicy === 'allow'
      ? '--allow-installs'
      : '--no-installs',
  );

  if (inputs.securityScanPaths) {
    args.push('--security-scan-paths', inputs.securityScanPaths);
  }
  if (inputs.securityScanSkills) {
    args.push('--security-scan-skills', inputs.securityScanSkills);
  }

  return args;
}

export function buildNpxCommand(inputs) {
  const args = [
    '--yes',
    `skill-check@${inputs.cliVersion}`,
    ...buildSkillCheckArgs(inputs),
  ];

  return {
    command: 'npx',
    args,
  };
}

export function formatCommand(command, args) {
  return [command, ...args]
    .map((part) =>
      /[\s"]/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part,
    )
    .join(' ');
}

function writeOutput(name, value, outputPath) {
  if (!outputPath) return;
  const delimiter = `EOF_${name}_${Date.now()}`;
  const body = `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  fs.appendFileSync(outputPath, body, 'utf8');
}

export async function runCommand(spec, options) {
  const { cwd, captureStdout, env } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let capturedStdout = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (captureStdout) {
        capturedStdout += chunk.toString('utf8');
      }
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      resolve({
        exitCode: typeof code === 'number' ? code : 2,
        stdout: capturedStdout,
      });
    });
  });
}

function writeSarifFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export async function runAction(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const outputPath = env.GITHUB_OUTPUT;
  const commandRunner = options.runCommand ?? runCommand;

  let commandText = '';
  let exitCode = 2;
  let sarifFileOutput = '';

  try {
    const inputs = parseActionInputs(env);
    validateActionInputs(inputs);

    const command = buildNpxCommand(inputs);
    commandText = formatCommand(command.command, command.args);

    const result = await commandRunner(command, {
      cwd,
      captureStdout: inputs.format === 'sarif',
      env,
    });

    exitCode = result.exitCode;

    if (inputs.format === 'sarif') {
      sarifFileOutput = path.resolve(cwd, inputs.sarifFile);
      writeSarifFile(sarifFileOutput, result.stdout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[skill-check action] ${message}\n`);
    exitCode = 2;
  } finally {
    writeOutput('command', commandText, outputPath);
    writeOutput('sarif-file', sarifFileOutput, outputPath);
    writeOutput('exit-code', String(exitCode), outputPath);
  }

  return exitCode;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  runAction()
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[skill-check action] ${message}\n`);
      process.exit(2);
    });
}
