import YAML from 'yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export interface FrontmatterParseResult {
  frontmatter: Record<string, unknown> | null;
  frontmatterRaw: string | null;
  body: string;
  error?: string;
}

export function parseFrontmatter(content: string): FrontmatterParseResult {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return {
      frontmatter: null,
      frontmatterRaw: null,
      body: content,
    };
  }

  const raw = match[1];
  const body = content.slice(match[0].length);

  try {
    const parsed = YAML.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        frontmatter: null,
        frontmatterRaw: raw,
        body,
        error: 'frontmatter must be a YAML object',
      };
    }
    return {
      frontmatter: parsed as Record<string, unknown>,
      frontmatterRaw: raw,
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      frontmatter: null,
      frontmatterRaw: raw,
      body,
      error: `invalid YAML frontmatter: ${message}`,
    };
  }
}
