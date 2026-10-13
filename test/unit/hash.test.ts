import {describe, it, expect} from 'vitest';
import {mkdtemp, writeFile, mkdir} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {hashSourceDir} from '../../src/core/hash.js';

describe('hashSourceDir', () => {
  it('returns the same hash for identical directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-hash-test-'));
    await writeFile(join(dir, 'main.js'), 'console.log("hello");', 'utf-8');
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'utils.js'), 'export const x = 1;', 'utf-8');

    const hash1 = await hashSourceDir(dir);
    const hash2 = await hashSourceDir(dir);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(12);
    expect(hash1).toMatch(/^[a-f0-9]{12}$/);
  });

  it('returns different hashes for different content', async () => {
    const dir1 = await mkdtemp(join(tmpdir(), 'kustron-hash-test-'));
    await writeFile(join(dir1, 'main.js'), 'console.log("hello");', 'utf-8');

    const dir2 = await mkdtemp(join(tmpdir(), 'kustron-hash-test-'));
    await writeFile(join(dir2, 'main.js'), 'console.log("world");', 'utf-8');

    const hash1 = await hashSourceDir(dir1);
    const hash2 = await hashSourceDir(dir2);

    expect(hash1).not.toBe(hash2);
  });

  it('ignores node_modules and .git', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-hash-test-'));
    await writeFile(join(dir, 'main.js'), 'console.log("hello");', 'utf-8');
    await mkdir(join(dir, 'node_modules'));
    await writeFile(join(dir, 'node_modules', 'junk.js'), 'junk', 'utf-8');
    await mkdir(join(dir, '.git'));
    await writeFile(join(dir, '.git', 'config'), 'junk', 'utf-8');

    const hash1 = await hashSourceDir(dir);

    // Change ignored files
    await writeFile(join(dir, 'node_modules', 'junk.js'), 'different', 'utf-8');

    const hash2 = await hashSourceDir(dir);
    expect(hash1).toBe(hash2);
  });
});
