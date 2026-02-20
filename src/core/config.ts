import fs from 'node:fs';
import path from 'node:path';
import type {
  CliOptions,
  LimitsConfig,
  OutputConfig,
  ResolvedConfig,
  RuleLevel,
} from '../types.js';
import {
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  DEFAULT_LIMITS,
  DEFAULT_OUTPUT,
} from './defaults.js';
import { CliError } from './errors.js';

type UserConfig = {
  roots?: string[];
  include?: string[];
  exclude?: string[];
  limits?: Partial<LimitsConfig>;
  rules?: Record<string, RuleLevel>;
  allowlist?: string[];
  plugins?: string[];
  output?: Partial<OutputConfig>;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid JSON in ${filePath}: ${message}`, 2);
  }
}

function validateConfigShape(config: unknown, sourcePath?: string): UserConfig {
  if (!isObjectRecord(config)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: config must be an object`,
      2,
    );
  }

  const knownKeys = new Set([
    'roots',
    'include',
    'exclude',
    'limits',
    'rules',
    'allowlist',
    'plugins',
    'output',
  ]);

  for (const key of Object.keys(config)) {
    if (!knownKeys.has(key)) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: unknown key "${key}"`,
        2,
      );
    }
  }

  if (config.roots !== undefined && !isStringArray(config.roots)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: roots must be string[]`,
      2,
    );
  }
  if (config.include !== undefined && !isStringArray(config.include)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: include must be string[]`,
      2,
    );
  }
  if (config.exclude !== undefined && !isStringArray(config.exclude)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: exclude must be string[]`,
      2,
    );
  }
  if (config.allowlist !== undefined && !isStringArray(config.allowlist)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: allowlist must be string[]`,
      2,
    );
  }
  if (config.plugins !== undefined && !isStringArray(config.plugins)) {
    throw new CliError(
      `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: plugins must be string[]`,
      2,
    );
  }

  if (config.limits !== undefined) {
    if (!isObjectRecord(config.limits)) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: limits must be an object`,
        2,
      );
    }
    for (const [key, value] of Object.entries(config.limits)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new CliError(
          `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: limits.${key} must be a positive number`,
          2,
        );
      }
    }
  }

  if (config.rules !== undefined) {
    if (!isObjectRecord(config.rules)) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: rules must be an object`,
        2,
      );
    }
    for (const value of Object.values(config.rules)) {
      if (value !== 'off' && value !== 'warn' && value !== 'error') {
        throw new CliError(
          `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: rules values must be off|warn|error`,
          2,
        );
      }
    }
  }

  if (config.output !== undefined) {
    if (!isObjectRecord(config.output)) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: output must be an object`,
        2,
      );
    }
    if (
      config.output.format !== undefined &&
      config.output.format !== 'text' &&
      config.output.format !== 'json' &&
      config.output.format !== 'sarif' &&
      config.output.format !== 'html' &&
      config.output.format !== 'github'
    ) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: output.format must be text|json|sarif|html|github`,
        2,
      );
    }
    if (
      config.output.reportPath !== undefined &&
      typeof config.output.reportPath !== 'string'
    ) {
      throw new CliError(
        `Invalid config${sourcePath ? ` (${sourcePath})` : ''}: output.reportPath must be string`,
        2,
      );
    }
  }

  return config as UserConfig;
}

function mergeConfig(base: UserConfig, override: UserConfig): UserConfig {
  return {
    ...base,
    ...override,
    limits: {
      ...(base.limits ?? {}),
      ...(override.limits ?? {}),
    },
    rules: {
      ...(base.rules ?? {}),
      ...(override.rules ?? {}),
    },
    output: {
      ...(base.output ?? {}),
      ...(override.output ?? {}),
    },
  };
}

function resolveRoots(cwd: string, roots: string[]): string[] {
  return roots.map((root) => path.resolve(cwd, root));
}

function normalizeList(
  values: string[] | undefined,
  fallback: string[],
): string[] {
  if (!values || values.length === 0) return fallback;
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeRules(
  values: Record<string, RuleLevel> | undefined,
): Record<string, RuleLevel> {
  if (!values) return {};
  const normalized: Record<string, RuleLevel> = {};
  for (const [ruleId, level] of Object.entries(values)) {
    if (level === 'off' || level === 'warn' || level === 'error') {
      normalized[ruleId] = level;
    }
  }
  return normalized;
}

export async function resolveConfig(
  cwd: string,
  targetPath: string | undefined,
  cli: CliOptions,
): Promise<ResolvedConfig> {
  if (cli.strict && cli.lenient) {
    throw new CliError('Cannot use --strict and --lenient together.', 2);
  }

  const explicitConfigPath = cli.configPath
    ? path.resolve(cwd, cli.configPath)
    : undefined;
  const defaultConfigPath = path.resolve(cwd, 'skill-check.config.json');

  let fileConfig: UserConfig = {};
  let configPath: string | undefined;

  if (explicitConfigPath) {
    if (!fs.existsSync(explicitConfigPath)) {
      throw new CliError(`Config file not found: ${explicitConfigPath}`, 2);
    }
    configPath = explicitConfigPath;
    fileConfig = validateConfigShape(
      readJsonFile(explicitConfigPath),
      explicitConfigPath,
    );
  } else if (fs.existsSync(defaultConfigPath)) {
    configPath = defaultConfigPath;
    fileConfig = validateConfigShape(
      readJsonFile(defaultConfigPath),
      defaultConfigPath,
    );
  }

  const optionConfig: UserConfig = {};
  if (cli.include && cli.include.length > 0) {
    optionConfig.include = cli.include;
  }
  if (cli.exclude && cli.exclude.length > 0) {
    optionConfig.exclude = cli.exclude;
  }
  if (
    typeof cli.maxBodyLines === 'number' ||
    typeof cli.maxDescriptionChars === 'number'
  ) {
    optionConfig.limits = {};
    if (typeof cli.maxBodyLines === 'number') {
      optionConfig.limits.maxBodyLines = cli.maxBodyLines;
    }
    if (typeof cli.maxDescriptionChars === 'number') {
      optionConfig.limits.maxDescriptionChars = cli.maxDescriptionChars;
    }
  }
  if (cli.format) {
    optionConfig.output = {
      format: cli.format,
    };
  }

  const merged = mergeConfig(fileConfig, optionConfig);

  const roots = targetPath ? [targetPath] : normalizeList(merged.roots, ['.']);
  const include = normalizeList(merged.include, DEFAULT_INCLUDE);
  const exclude = normalizeList(merged.exclude, DEFAULT_EXCLUDE);

  const limits: LimitsConfig = {
    ...DEFAULT_LIMITS,
    ...(merged.limits ?? {}),
  };

  const output: OutputConfig = {
    ...DEFAULT_OUTPUT,
    ...(merged.output ?? {}),
  };

  const rules = normalizeRules(merged.rules);
  if (cli.lenient) {
    rules['frontmatter.name_matches_directory'] = 'off';
  }

  const failOnWarning = Boolean(cli.failOnWarning || cli.strict);
  const strictMode = Boolean(cli.strict);
  const lenientMode = Boolean(cli.lenient);

  const rootsAbs = resolveRoots(cwd, roots);
  const reportPath = output.reportPath
    ? path.resolve(cwd, output.reportPath)
    : undefined;

  return {
    cwd,
    configPath,
    roots,
    rootsAbs,
    include,
    exclude,
    limits,
    rules,
    allowlist: merged.allowlist ?? [],
    plugins: merged.plugins ?? [],
    output: {
      ...output,
      reportPath,
    },
    failOnWarning,
    strictMode,
    lenientMode,
  };
}
