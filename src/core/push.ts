import {exec} from '../utils/exec.js';
import {info} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import {detectContainerRuntime} from '../utils/container-runtime.js';

export const REGISTRY_HOST = 'kustron-registry:5000';
export const REGISTRY_PUSH_HOST = 'localhost:5000';

export function buildTag(appName: string, ref: string): string {
  return `${REGISTRY_HOST}/${appName}:${ref}`;
}

export function buildPushTag(appName: string, ref: string): string {
  return `${REGISTRY_PUSH_HOST}/${appName}:${ref}`;
}

export async function pushImage(tag: string): Promise<void> {
  const runtime = await detectContainerRuntime();
  info(t('deploy.pushingImage'));
  await exec(runtime, ['push', tag]);
}
