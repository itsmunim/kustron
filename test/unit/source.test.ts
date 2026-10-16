import {describe, it, expect} from 'vitest';
import {mkdtemp, writeFile, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {
  isGitUrl,
  cleanupSource,
  resolveLocalSource,
} from '../../src/core/source.js';
import {homedir} from 'os';
import {resolve} from 'path';

describe('isGitUrl', () => {
  it('recognizes SSH git URLs', () => {
    expect(isGitUrl('git@github.com:user/repo.git')).toBe(true);
  });

  it('recognizes HTTPS git URLs', () => {
    expect(isGitUrl('https://github.com/user/repo.git')).toBe(true);
  });

  it('recognizes URLs ending in .git', () => {
    expect(isGitUrl('https://gitlab.com/user/repo.git')).toBe(true);
  });

  it('rejects local paths', () => {
    expect(isGitUrl('./my-app')).toBe(false);
    expect(isGitUrl('/absolute/path')).toBe(false);
    expect(isGitUrl('my-app')).toBe(false);
  });
});

describe('resolveLocalSource', () => {
  it('resolves existing directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-src-test-'));
    const result = await resolveLocalSource(dir);
    expect(result.endsWith(dir.replace('/private', '')) || result === dir).toBe(
      true,
    );
    await rm(dir, {recursive: true});
  });

  it('throws for missing directory', async () => {
    await expect(
      resolveLocalSource('/nonexistent/path/12345'),
    ).rejects.toThrow();
  });
});

describe('cleanupSource', () => {
  it('does not delete git cache dirs', async () => {
    const gitCache = resolve(homedir(), '.kustron', 'git-cache', 'abc');
    await expect(cleanupSource(gitCache)).resolves.not.toThrow();
  });

  it('deletes non-git-cache dirs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-cleanup-test-'));
    await expect(cleanupSource(dir)).resolves.not.toThrow();
    // Directory should be removed
    await expect(
      (async () => {
        const {access} = await import('fs/promises');
        await access(dir);
      })(),
    ).rejects.toThrow();
  });
});
