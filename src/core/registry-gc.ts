import {exec} from '../utils/exec.js';
import {info} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import {detectContainerRuntime} from '../utils/container-runtime.js';

/**
 * Prune old images from the local registry that are no longer referenced
 * by any running deployment. Keeps images that are still in use.
 */
export async function pruneRegistry(
  clusterName: string,
  registryPort: number,
): Promise<void> {
  const runtime = await detectContainerRuntime();

  // List all images in the local registry
  try {
    const {stdout} = await exec('curl', [
      '-s',
      `http://localhost:${registryPort}/v2/_catalog`,
    ], {silent: true, reject: false});

    if (!stdout.trim()) return;

    const catalog = JSON.parse(stdout) as {repositories?: string[]};
    const repos = catalog.repositories ?? [];

    for (const repo of repos) {
      try {
        const {stdout: tagsStdout} = await exec('curl', [
          '-s',
          `http://localhost:${registryPort}/v2/${repo}/tags/list`,
        ], {silent: true, reject: false});

        if (!tagsStdout.trim()) continue;

        const tagsData = JSON.parse(tagsStdout) as {tags?: string[]};
        const tags = tagsData.tags ?? [];

        for (const tag of tags) {
          const imageRef = `localhost:${registryPort}/${repo}:${tag}`;

          // Check if this image is still in use by any deployment
          const inUse = await isImageInUse(imageRef, clusterName);
          if (!inUse) {
            info(t('registry.pruning', {image: imageRef}));
            try {
              await exec(runtime, ['rmi', imageRef], {silent: true, reject: false});
            } catch {
              // ignore individual prune failures
            }
          }
        }
      } catch {
        // ignore repo-level failures
      }
    }
  } catch {
    // Registry catalog API may not be available — skip GC
  }
}

async function isImageInUse(imageRef: string, clusterName: string): Promise<boolean> {
  try {
    const {stdout} = await exec('kubectl', [
      'get',
      'pods',
      '--all-namespaces',
      '--context',
      `k3d-${clusterName}`,
      '-o',
      'jsonpath={.items[*].spec.containers[*].image}',
    ], {silent: true, reject: false});

    const usedImages = stdout.split(/\s+/).filter(Boolean);
    return usedImages.some((img) => img === imageRef || img.includes(imageRef.split(':')[0]));
  } catch {
    return true; // assume in use if we can't check
  }
}
