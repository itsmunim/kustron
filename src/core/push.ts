import {exec} from '../utils/exec.js';
import {info} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import {detectContainerRuntime} from '../utils/container-runtime.js';

export const REGISTRY_HOST = 'kustron-registry:5000';

export function getRegistryPushHost(port: number): string {
  return `localhost:${port}`;
}

export function buildTag(appName: string, ref: string): string {
  return `${REGISTRY_HOST}/${appName}:${ref}`;
}

export function buildPushTag(appName: string, ref: string, port: number): string {
  return `${getRegistryPushHost(port)}/${appName}:${ref}`;
}

export async function pushImage(tag: string, registryHost?: string): Promise<void> {
  const runtime = await detectContainerRuntime();
  info(t('deploy.pushingImage'));

  const args = ['push', tag];

  // podman requires --tls-verify=false for local HTTP registries
  if (runtime === 'podman' && registryHost?.startsWith('localhost')) {
    args.push('--tls-verify=false');
  }

  await exec(runtime, args);
}
