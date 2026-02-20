import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractMarkdownLinks,
  isLocalResolvableTarget,
  normalizeTarget,
  resolveLocalTarget,
  stripQueryAndFragment,
} from '../../src/core/links.js';

describe('links', () => {
  it('extracts markdown links outside code fences', () => {
    const content = [
      'See [ok](references/a.md).',
      '```md',
      '[ignored](references/b.md)',
      '```',
    ].join('\n');

    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]?.normalizedTarget).toBe('references/a.md');
  });

  it('normalizes and classifies local links', () => {
    expect(normalizeTarget(' references/a.md ')).toBe('references/a.md');
    expect(stripQueryAndFragment('references/a.md?x=1#t')).toBe(
      'references/a.md',
    );
    expect(isLocalResolvableTarget('references/a.md')).toBe(true);
    expect(isLocalResolvableTarget('https://example.com')).toBe(false);
    expect(isLocalResolvableTarget('#anchor')).toBe(false);
  });

  it('resolves local targets relative to file', () => {
    const file = '/tmp/repo/global/skills/x/SKILL.md';
    const resolved = resolveLocalTarget(file, 'references/guide.md');
    expect(resolved).toBe(
      path.resolve('/tmp/repo/global/skills/x/references/guide.md'),
    );
  });
});
