import {exec} from '../utils/exec.js';
import {detectContainerRuntime} from '../utils/container-runtime.js';
import {info, error} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import type {AppEntry} from '../types/index.js';

/** docker/podman login to a registry (stores creds in the runtime's config). */
export async function registryLogin(
  server: string,
  username?: string,
  password?: string,
): Promise<void> {
  const runtime = await detectContainerRuntime();
  const args = ['login', server];
  if (username) args.push('-u', username);
  if (password) args.push('-p', password);
  info(t('registry.login', {server}));
  await exec(runtime, args);
}

/**
 * Create an imagePullSecret for an app pointing at a private registry, and
 * return the secret name for the Deployment manifest. Idempotent in the sense
 * that kubectl apply of an existing secret is a no-op.
 */
export async function ensurePullSecret(
  app: AppEntry,
  namespace: string,
): Promise<string | undefined> {
  const registry = app.registry;
  if (!registry?.server || !registry.username) return undefined;

  const secretName = `${app.name}-registry-creds`;
  const args = [
    'create',
    'secret',
    'docker-registry',
    secretName,
    '--namespace',
    namespace,
    '--docker-server',
    registry.server,
    '--docker-username',
    registry.username,
    '--docker-password',
    registry.password ?? '',
    '--dry-run=client',
    '-o',
    'yaml',
  ];
  const {stdout} = await exec('kubectl', args, {
    silent: true,
    reject: false,
  } as Record<string, unknown>);
  await exec('kubectl', ['apply', '-f', '-'], {
    input: stdout,
    silent: true,
  } as Record<string, unknown>);
  return secretName;
}

/**
 * Alternative to push: load an image that already exists in the local runtime
 * directly into the k3d cluster (`k3d image import`). Useful when the image
 * can't be pushed to the internal registry (air-gapped, pre-built locally).
 */
export async function importImageToCluster(
  image: string,
  clusterName = 'kustron',
): Promise<void> {
  info(t('registry.importing', {image}));
  await exec('k3d', ['image', 'import', image, '-c', clusterName]);
}

export async function importImagesToCluster(
  images: string[],
  clusterName = 'kustron',
): Promise<void> {
  if (images.length === 0) {
    error(t('registry.noImages'));
    return;
  }
  for (const image of images) {
    await importImageToCluster(image, clusterName);
  }
}