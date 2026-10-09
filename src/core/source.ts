import {access, realpath, rm, mkdir} from 'fs/promises';
import {resolve, join} from 'path';
import {homedir} from 'os';
import {createHash} from 'crypto';
import {error} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import {exec} from '../utils/exec.js';

const GIT_CACHE_DIR = resolve(homedir(), '.kustron', 'git-cache');

export async function resolveLocalSource(input: string): Promise<string> {
  const absolutePath = resolve(input);

  try {
    await access(absolutePath);
  } catch {
    error(t('deploy.sourceNotFound', {path: absolutePath}));
    throw new Error(t('deploy.sourceNotFound', {path: absolutePath}));
  }

  return realpath(absolutePath);
}

export function isGitUrl(input: string): boolean {
  return (
    input.startsWith('git@') ||
    input.startsWith('https://') ||
    input.endsWith('.git')
  );
}

export async function verifyGitAccess(url: string): Promise<void> {
  try {
    await exec('git', ['ls-remote', '--exit-code', url, 'HEAD']);
  } catch {
    error(t('deploy.gitAccessDenied', {url}));
    throw new Error(t('deploy.gitAccessDenied', {url}));
  }
}

export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  await exec('git', ['clone', url, targetDir]);
}

async function isValidGitRepo(dir: string): Promise<boolean> {
  try {
    await exec('git', ['-C', dir, 'rev-parse', '--git-dir'], {silent: true});
    return true;
  } catch {
    return false;
  }
}

export async function resolveGitSource(url: string): Promise<string> {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const targetDir = resolve(GIT_CACHE_DIR, hash);

  await mkdir(GIT_CACHE_DIR, {recursive: true});

  if (await isValidGitRepo(targetDir)) {
    // Cached repo exists — fetch and pull instead of re-cloning
    await exec('git', ['-C', targetDir, 'fetch', 'origin']);
    await exec('git', ['-C', targetDir, 'reset', '--hard', 'origin/HEAD']);
  } else {
    // Clean up partial/broken clone and re-clone
    await rm(targetDir, {recursive: true, force: true});
    await cloneRepo(url, targetDir);
  }

  return targetDir;
}

export async function cleanupSource(path: string): Promise<void> {
  // Only cleanup temp dirs, not cached git repos
  if (!path.startsWith(GIT_CACHE_DIR)) {
    await rm(path, {recursive: true, force: true});
  }
}
