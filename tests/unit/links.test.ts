import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractMarkdownLinks,
  isLocalResolvableTarget,
  normalizeTarget,
  resolveLocalTarget,
  stripQueryAndFragment,
} from '../../src/core/links.js';
import { linkRules } from '../../src/rules/core/links.js';
import type { RuleContext, SkillArtifact } from '../../src/types.js';

const context: RuleContext = {
  config: {
    cwd: '/tmp',
    roots: ['.'],
    rootsAbs: ['/tmp'],
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
  },
  resolveRuleLevel: (_id, fallback) => fallback,
};

describe('links utilities', () => {
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

  it('excludes links inside unclosed code fences', () => {
    const content = ['See [ok](file-a.md).', '```', '[fenced](file-b.md)'].join(
      '\n',
    );

    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]?.normalizedTarget).toBe('file-a.md');
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

  it('normalizes angle-bracket link targets', () => {
    expect(normalizeTarget('<references/a.md>')).toBe('references/a.md');
  });

  it('normalizes link targets with title text', () => {
    expect(normalizeTarget('references/a.md "Title"')).toBe('references/a.md');
    expect(normalizeTarget("references/a.md 'Title'")).toBe('references/a.md');
  });

  it('classifies absolute paths as non-resolvable', () => {
    expect(isLocalResolvableTarget('/absolute/path.md')).toBe(false);
  });

  it('classifies template paths as non-resolvable', () => {
    expect(isLocalResolvableTarget('{variable}/path.md')).toBe(false);
  });

  it('resolves local targets relative to file', () => {
    const file = '/tmp/repo/global/skills/x/SKILL.md';
    const resolved = resolveLocalTarget(file, 'references/guide.md');
    expect(resolved).toBe(
      path.resolve('/tmp/repo/global/skills/x/references/guide.md'),
    );
  });
});

describe('links.local_markdown_resolves', () => {
  const rule = linkRules.find((r) => r.id === 'links.local_markdown_resolves')!;

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-test-'));
    fs.mkdirSync(path.join(tmpDir, 'references'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeSkill(content: string): SkillArtifact {
    const skillFile = path.join(tmpDir, 'SKILL.md');
    return {
      id: 'test/my-skill',
      category: 'test',
      slug: 'my-skill',
      filePath: skillFile,
      relativePath: 'skills/my-skill/SKILL.md',
      content,
      body: content,
      frontmatter: { name: 'my-skill', description: 'test' },
      frontmatterRaw: 'name: my-skill\ndescription: test',
    };
  }

  it('passes when local links resolve', () => {
    fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide');
    const skill = makeSkill('See [guide](guide.md) for details.');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('reports broken local links', async () => {
    const skill = makeSkill('See [missing](nonexistent.md) for details.');
    const findings = await rule.evaluate(skill, context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('broken local link');
    expect(findings[0]?.message).toContain('nonexistent.md');
  });

  it('ignores references/ links (handled by references_resolve)', () => {
    const skill = makeSkill('See [ref](references/guide.md).');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('ignores external links', () => {
    const skill = makeSkill('See [example](https://example.com).');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('returns no findings when no links present', () => {
    const skill = makeSkill('No links here.');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });
});

describe('links.references_resolve', () => {
  const rule = linkRules.find((r) => r.id === 'links.references_resolve')!;

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-ref-test-'));
    fs.mkdirSync(path.join(tmpDir, 'references'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeSkill(content: string): SkillArtifact {
    const skillFile = path.join(tmpDir, 'SKILL.md');
    return {
      id: 'test/my-skill',
      category: 'test',
      slug: 'my-skill',
      filePath: skillFile,
      relativePath: 'skills/my-skill/SKILL.md',
      content,
      body: content,
      frontmatter: { name: 'my-skill', description: 'test' },
      frontmatterRaw: 'name: my-skill\ndescription: test',
    };
  }

  it('passes when references/ link resolves', () => {
    fs.writeFileSync(path.join(tmpDir, 'references', 'guide.md'), '# Guide');
    const skill = makeSkill('See [guide](references/guide.md).');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });

  it('reports broken references/ links', async () => {
    const skill = makeSkill('See [guide](references/missing.md).');
    const findings = await rule.evaluate(skill, context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('broken references link');
    expect(findings[0]?.message).toContain('references/missing.md');
  });

  it('ignores non-references local links', () => {
    const skill = makeSkill('See [guide](guide.md).');
    expect(rule.evaluate(skill, context)).toHaveLength(0);
  });
});
