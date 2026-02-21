import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  renderShareImageSvg,
  writeShareImage,
} from '../../src/core/share-image.js';

describe('share image SVG', () => {
  it('renders valid svg content from a card', () => {
    const svg = renderShareImageSvg('+---+\n| <a> |\n+---+');

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('skill-check share');
    expect(svg).toContain('&lt;');
  });

  it('writes png output file by default', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-share-svg-'),
    );
    const outputPath = path.join(tempDir, 'card');
    const writtenPath = writeShareImage('+---+\n| hi |\n+---+', outputPath);

    expect(writtenPath).toBe(path.resolve(`${outputPath}.png`));
    expect(fs.existsSync(writtenPath)).toBe(true);
    const header = fs.readFileSync(writtenPath).subarray(0, 8);
    expect(Array.from(header)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('writes svg when extension is .svg', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'skill-check-share-svg-'),
    );
    const outputPath = path.join(tempDir, 'card.svg');
    const writtenPath = writeShareImage('+---+\n| hi |\n+---+', outputPath);

    expect(writtenPath).toBe(path.resolve(outputPath));
    const content = fs.readFileSync(writtenPath, 'utf8');
    expect(content).toContain('<svg');
  });
});
