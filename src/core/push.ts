import {exec} from '../utils/exec.js';
import {info} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import {detectContainerRuntime} from '../utils/container-runtime.js';
import {registryName} from './cluster.js';

export const REGISTRY_HOST = 'kustron-registry:5000';

/**
 * In-cluster registry host is cluster-scoped (see registryName in cluster.ts).
 * The default cluster keeps 'kustron-registry:5000' for backward compat.
 */
export function registryHostFor(clusterName?: string): string {
  return `${registryName(clusterName)}:5000`;
}

export function getRegistryPushHost(port: number): string {
  return `localhost:${port}`;
}

export function buildTag(
  appName: string,
  ref: string,
  registryHost?: string,
): string {
  return `${registryHost ?? REGISTRY_HOST}/${appName}:${ref}`;
}

export function buildPushTag(
  appName: string,
  ref: string,
  port: number,
): string {
  return `${getRegistryPushHost(port)}/${appName}:${ref}`;
}

export async function pushImage(
  tag: string,
  registryHost?: string,
): Promise<void> {
  const runtime = await detectContainerRuntime();
  info(t('deploy.pushingImage'));

  const args = ['push', tag];

  // podman requires --tls-verify=false for local HTTP registries
  if (runtime === 'podman' && registryHost?.startsWith('localhost')) {
    args.push('--tls-verify=false');
  }

  await exec(runtime, args);
}
