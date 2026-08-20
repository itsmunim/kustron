import {access} from 'fs/promises';
import {join} from 'path';
import {exec} from '../utils/exec.js';
import {info} from '../utils/logger.js';
import {t} from '../utils/i18n.js';

export type BuildStrategy = 'dockerfile' | 'railpack';

export async function detectBuildStrategy(
  sourcePath: string,
): Promise<BuildStrategy> {
  try {
    await access(join(sourcePath, 'Dockerfile'));
    info(t('build.dockerfileFound'));
    return 'dockerfile';
  } catch {
    info(t('build.dockerfileNotFound'));
    return 'railpack';
  }
}

export async function buildImage(
  sourcePath: string,
  imageTag: string,
  strategy: BuildStrategy,
): Promise<void> {
  if (strategy === 'dockerfile') {
    info(t('build.dockerBuild'));
    await exec('docker', ['build', '-t', imageTag, sourcePath]);
  } else {
    info(t('build.railpackBuild'));
    await exec('railpack', ['build', sourcePath, '--name', imageTag]);
  }
}
