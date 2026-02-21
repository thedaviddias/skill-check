import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g');

const BASE_FONT_SIZE = 18;
const LINE_HEIGHT = 28;
const CHAR_WIDTH = 10;
const PADDING_X = 32;
const PADDING_Y = 32;
const SUPPORTED_OUTPUT_FORMATS = new Set(['png', 'svg']);

const DEFAULT_FILL = '#eaf2ff';
const DIM_FILL = '#94a3b8';
const RED_FILL = '#ef4444';
const GREEN_FILL = '#22c55e';
const YELLOW_FILL = '#eab308';
const CYAN_FILL = '#06b6d4';

type ShareImageFormat = 'png' | 'svg';

interface ColoredSegment {
  text: string;
  fill: string;
}

function ansiToFill(code: string): string | null {
  if (code === '\x1b[0m' || code === '\x1b[39m') return DEFAULT_FILL;
  if (code === '\x1b[22m') return DEFAULT_FILL;
  if (code === '\x1b[2m') return DIM_FILL;
  if (code.includes('31')) return RED_FILL;
  if (code.includes('32')) return GREEN_FILL;
  if (code.includes('33')) return YELLOW_FILL;
  if (code.includes('36')) return CYAN_FILL;
  return null;
}

function parseAnsiLine(line: string): ColoredSegment[] {
  const raw: ColoredSegment[] = [];
  let fill = DEFAULT_FILL;
  let lastIndex = 0;
  ANSI_RE.lastIndex = 0;
  let match = ANSI_RE.exec(line);
  while (match !== null) {
    const text = line.slice(lastIndex, match.index);
    if (text.length > 0) {
      raw.push({ text, fill });
    }
    const nextFill = ansiToFill(match[0]);
    if (nextFill !== null) fill = nextFill;
    lastIndex = match.index + match[0].length;
    match = ANSI_RE.exec(line);
  }
  const tail = line.slice(lastIndex);
  if (tail.length > 0) {
    raw.push({ text: tail, fill });
  }

  // resvg drops whitespace-only tspan elements, so merge them into the
  // preceding segment to keep spaces visible.
  const segments: ColoredSegment[] = [];
  for (const seg of raw) {
    if (seg.text.trim() === '' && segments.length > 0) {
      const prev = segments[segments.length - 1];
      segments[segments.length - 1] = {
        text: prev.text + seg.text,
        fill: prev.fill,
      };
    } else {
      segments.push(seg);
    }
  }
  return segments;
}

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function renderShareImageSvg(cardText: string): string {
  const trimmed = cardText.trimEnd();
  const lines = trimmed.split('\n');
  const maxChars = Math.max(
    1,
    ...lines.map((line) => line.replace(ANSI_RE, '').length),
  );

  const textBlockWidth = Math.ceil(maxChars * CHAR_WIDTH);
  const textBlockHeight = Math.max(1, lines.length) * LINE_HEIGHT;
  const canvasWidth = textBlockWidth + PADDING_X * 2;
  const canvasHeight = textBlockHeight + PADDING_Y * 2;
  const textX = PADDING_X;
  const textStartY = PADDING_Y + BASE_FONT_SIZE;

  const fontFamily =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

  const lineElements = lines
    .map((line, index) => {
      const y = textStartY + index * LINE_HEIGHT;
      const segments = parseAnsiLine(line);
      if (segments.length === 0) {
        return `  <text x="${textX}" y="${y}" fill="${DEFAULT_FILL}" font-family="${fontFamily}" font-size="${BASE_FONT_SIZE}"></text>`;
      }
      const tspans = segments
        .map((seg) => {
          const escaped = escapeXml(seg.text);
          return `<tspan fill="${seg.fill}">${escaped}</tspan>`;
        })
        .join('');
      return `  <text x="${textX}" y="${y}" font-family="${fontFamily}" font-size="${BASE_FONT_SIZE}" xml:space="preserve">${tspans}</text>`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-label="skill-check share card">`,
    '  <rect width="100%" height="100%" fill="#0d1117"/>',
    lineElements,
    '</svg>',
    '',
  ].join('\n');
}

function resolveOutputTarget(outputPath: string): {
  path: string;
  format: ShareImageFormat;
} {
  const resolved = path.resolve(outputPath);
  const ext = path.extname(resolved).toLowerCase().replace('.', '');
  const parsed = path.parse(resolved);
  const format = SUPPORTED_OUTPUT_FORMATS.has(ext) ? ext : 'png';
  const finalPath =
    format === ext
      ? resolved
      : path.join(parsed.dir, `${parsed.name}.${format}`);

  return { path: finalPath, format: format as ShareImageFormat };
}

export function writeShareImage(cardText: string, outputPath: string): string {
  const target = resolveOutputTarget(outputPath);
  const parent = path.dirname(target.path);
  fs.mkdirSync(parent, { recursive: true });
  try {
    fs.unlinkSync(target.path);
  } catch {
    // ignore if file does not exist
  }
  const svg = renderShareImageSvg(cardText);

  if (target.format === 'svg') {
    fs.writeFileSync(target.path, svg, 'utf8');
    return target.path;
  }

  const resvg = new Resvg(svg);
  const pngData = resvg.render().asPng();
  fs.writeFileSync(target.path, pngData);
  return target.path;
}
