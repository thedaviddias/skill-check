import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Open a URL or file path in the user's default browser.
 * Cross-platform: macOS (open), Linux (xdg-open), Windows (start).
 * Uses the absolute file path (not file://) so the OS opens it with the default app and avoids browser file-URL restrictions.
 */
export function openInBrowser(urlOrPath: string): void {
  const absolutePath = urlOrPath.startsWith('file:')
    ? fileURLToPath(urlOrPath)
    : path.resolve(urlOrPath);
  const command =
    platform() === 'win32'
      ? `start "" "${absolutePath}"`
      : platform() === 'darwin'
        ? `open "${absolutePath}"`
        : `xdg-open "${absolutePath}"`;
  execSync(command, { stdio: 'ignore' });
}
