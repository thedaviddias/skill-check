import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../../src/core/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses quoted values', () => {
    const content = `---\nname: "my-skill"\ndescription: "Use when checking quotes."\n---\n\nBody\n`;
    const parsed = parseFrontmatter(content);
    expect(parsed.frontmatter?.name).toBe('my-skill');
    expect(parsed.frontmatter?.description).toBe('Use when checking quotes.');
  });

  it('parses folded scalar descriptions', () => {
    const content = `---\nname: my-skill\ndescription: >\n  Use when line one\n  and line two\n---\n`;
    const parsed = parseFrontmatter(content);
    expect(typeof parsed.frontmatter?.description).toBe('string');
    expect(String(parsed.frontmatter?.description)).toContain(
      'Use when line one',
    );
  });

  it('parses multiline values', () => {
    const content = `---\nname: my-skill\ndescription: |\n  Use when testing\n  multiline text\n---\n`;
    const parsed = parseFrontmatter(content);
    expect(String(parsed.frontmatter?.description)).toContain('multiline text');
  });
});
