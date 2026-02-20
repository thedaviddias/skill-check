import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, platform: vi.fn(() => 'darwin') };
});

describe('openInBrowser', () => {
  it('calls open on macOS', async () => {
    vi.mocked(platform).mockReturnValue('darwin');
    const mod = await import('../../src/core/open-browser.js');
    mod.openInBrowser('/tmp/report.html');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('open'),
      expect.any(Object),
    );
  });

  it('calls xdg-open on Linux', async () => {
    vi.mocked(platform).mockReturnValue('linux');
    const mod = await import('../../src/core/open-browser.js');
    mod.openInBrowser('/tmp/report.html');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('xdg-open'),
      expect.any(Object),
    );
  });

  it('calls start on Windows', async () => {
    vi.mocked(platform).mockReturnValue('win32');
    const mod = await import('../../src/core/open-browser.js');
    mod.openInBrowser('/tmp/report.html');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('start'),
      expect.any(Object),
    );
  });

  it('handles file:// URLs', async () => {
    vi.mocked(platform).mockReturnValue('darwin');
    const mod = await import('../../src/core/open-browser.js');
    mod.openInBrowser('file:///tmp/report.html');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/report.html'),
      expect.any(Object),
    );
  });
});
