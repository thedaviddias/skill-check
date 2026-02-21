import { describe, expect, it } from 'vitest';
import { loadPluginRules } from '../../src/core/plugins.js';
import type { ResolvedConfig } from '../../src/types.js';

const baseConfig: ResolvedConfig = {
  cwd: process.cwd(),
  roots: ['.'],
  rootsAbs: [process.cwd()],
  include: [],
  exclude: [],
  limits: {
    maxDescriptionChars: 1024,
    maxBodyLines: 500,
    minDescriptionChars: 50,
    maxBodyTokens: 5000,
    maxNameChars: 64,
    maxCompatibilityChars: 500,
  },
  rules: {},
  allowlist: [],
  plugins: [],
  output: { format: 'text' },
  failOnWarning: false,
  strictMode: false,
  lenientMode: false,
};

describe('loadPluginRules', () => {
  it('returns empty array when no plugins configured', async () => {
    const rules = await loadPluginRules(baseConfig);
    expect(rules).toHaveLength(0);
  });

  it('throws for non-existent plugin', async () => {
    await expect(
      loadPluginRules({ ...baseConfig, plugins: ['./nonexistent-plugin.js'] }),
    ).rejects.toThrow('Failed to load plugin');
  });

  it('throws for non-existent npm plugin', async () => {
    await expect(
      loadPluginRules({
        ...baseConfig,
        plugins: ['nonexistent-npm-package-that-does-not-exist'],
      }),
    ).rejects.toThrow('Failed to load plugin');
  });
});
