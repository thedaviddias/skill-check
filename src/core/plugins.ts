import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginModule, ResolvedConfig, RuleDefinition } from '../types.js';
import { CliError } from './errors.js';

export async function loadPluginRules(
  config: ResolvedConfig,
): Promise<RuleDefinition[]> {
  const rules: RuleDefinition[] = [];

  for (const pluginRef of config.plugins) {
    const isPathRef =
      pluginRef.startsWith('.') ||
      pluginRef.startsWith('/') ||
      pluginRef.includes(path.sep);
    const resolvedRef = isPathRef
      ? path.resolve(config.cwd, pluginRef)
      : pluginRef;

    let plugin: PluginModule;
    try {
      const module = isPathRef
        ? await import(pathToFileURL(resolvedRef).href)
        : await import(resolvedRef);
      plugin = module as PluginModule;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Failed to load plugin "${pluginRef}": ${message}`, 2);
    }

    if (!Array.isArray(plugin.rules)) {
      throw new CliError(`Plugin "${pluginRef}" must export a rules array.`, 2);
    }

    for (const rule of plugin.rules) {
      if (!rule || typeof rule !== 'object') {
        throw new CliError(
          `Plugin "${pluginRef}" contains an invalid rule entry.`,
          2,
        );
      }
      if (typeof rule.id !== 'string' || !rule.id) {
        throw new CliError(
          `Plugin "${pluginRef}" has a rule without a valid id.`,
          2,
        );
      }
      if (typeof rule.evaluate !== 'function') {
        throw new CliError(
          `Plugin "${pluginRef}" rule "${rule.id}" is missing evaluate().`,
          2,
        );
      }
      rules.push(rule);
    }
  }

  return rules;
}
