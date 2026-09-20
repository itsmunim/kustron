import {createHash, type Hash} from 'crypto';
import {readdir, readFile} from 'fs/promises';
import {join, relative} from 'path';

// Directories that don't affect the build output (mirrors typical
// .dockerignore rules). Skipping them keeps the hash stable across machines
// and ignores per-developer build artifacts.
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.cache',
  'coverage',
  'dist',
  '.keen',
]);

const IGNORED_FILES = new Set(['.DS_Store']);

async function hashDir(dir: string, hash: Hash, root: string): Promise<void> {
  const entries = await readdir(dir, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name) || IGNORED_FILES.has(entry.name)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }

    const full = join(dir, entry.name);
    const rel = relative(root, full);

    if (entry.isDirectory()) {
      hash.update(`dir ${rel}\n`);
      await hashDir(full, hash, root);
    } else if (entry.isFile()) {
      const content = await readFile(full);
      hash.update(`file ${rel} ${content.length}\n`);
      hash.update(content);
      hash.update('\n');
    }
  }
}

/**
 * Deterministic content hash of a source directory.
 *
 * Same tree -> same hash, on any machine. This is what makes image tags
 * deterministic: unchanged source produces the same tag, so `env up` becomes
 * a no-op instead of rebuilding + redeploying with a fresh version every time.
 */
export async function hashSourceDir(dir: string): Promise<string> {
  const hash = createHash('sha256');
  await hashDir(dir, hash, dir);
  return hash.digest('hex').slice(0, 12);
}