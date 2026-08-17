import { resolveLocalSource, isGitUrl } from '../core/source.js'
import { detectBuildStrategy, buildImage } from '../core/build.js'
import { tagForLocalRegistry, imageReferenceForCluster, pushImage } from '../core/push.js'
import { buildNamespace, buildDeployment, buildService, buildHPA } from '../core/manifest.js'
import { applyManifests, waitForRollout, getServiceNodePort } from '../core/apply.js'
import { exec } from '../utils/exec.js'
import { success, info, error } from '../utils/logger.js'
import { t } from '../utils/i18n.js'
import { Listr } from 'listr2'
import type { DeployOptions } from '../types/index.js'

export async function deploy(source: string, options: DeployOptions): Promise<void> {
  const required = ['name', 'port']
  const missing = required.filter((k) => !options[k as keyof DeployOptions])
  if (missing.length > 0) {
    error(t('deploy.missingRequiredOptions', { options: missing.join(', ') }))
    process.exit(1)
  }

  const imageTag = tagForLocalRegistry(options.name, 'latest')
  const clusterImage = imageReferenceForCluster(options.name, 'latest')

  let resolvedSource: string
  let strategy: import('../core/build.js').BuildStrategy
  let nodePort: string | null = null

  const tasks = new Listr([
    {
      title: t('deploy.resolvingSource'),
      task: async () => {
        if (isGitUrl(source)) {
          error(t('deploy.invalidGitUrl', { url: source }))
          throw new Error(t('deploy.invalidGitUrl', { url: source }))
        }
        resolvedSource = await resolveLocalSource(source)
      },
    },
    {
      title: t('deploy.checkingCluster'),
      task: async () => {
        try {
          await exec('kubectl', ['config', 'current-context'])
        } catch {
          error(t('deploy.clusterNotUp'))
          throw new Error(t('deploy.clusterNotUp'))
        }
      },
    },
    {
      title: t('deploy.detectingStrategy'),
      task: async () => {
        strategy = await detectBuildStrategy(resolvedSource)
      },
    },
    {
      title: t('deploy.building', { tag: imageTag }),
      task: async () => {
        await buildImage(resolvedSource, imageTag, strategy)
      },
    },
    {
      title: t('deploy.pushing'),
      task: async () => {
        await pushImage(imageTag)
      },
    },
    {
      title: t('deploy.generatingManifests'),
      task: () => {
        const namespace = options.ns ?? options.name
        const yaml = [
          buildNamespace(namespace),
          buildDeployment({
            name: options.name,
            namespace,
            image: clusterImage,
            port: options.port,
            replicas: options.replicas ?? 1,
            env: options.env ?? {},
            expose: options.expose ?? false,
            cpuRequest: options.cpuRequest,
            cpuLimit: options.cpuLimit,
            memoryRequest: options.memoryRequest,
            memoryLimit: options.memoryLimit,
          }),
          buildService({
            name: options.name,
            namespace,
            image: clusterImage,
            port: options.port,
            replicas: options.replicas ?? 1,
            env: options.env ?? {},
            expose: options.expose ?? false,
            cpuRequest: options.cpuRequest,
            cpuLimit: options.cpuLimit,
            memoryRequest: options.memoryRequest,
            memoryLimit: options.memoryLimit,
          }),
          ...(options.ha
            ? [
                buildHPA({
                  name: options.name,
                  namespace,
                  image: clusterImage,
                  port: options.port,
                  replicas: options.replicas ?? 1,
                  env: options.env ?? {},
                  expose: options.expose ?? false,
                }),
              ]
            : []),
        ].join('---\n')

        return applyManifests(yaml)
      },
    },
    {
      title: t('deploy.waitingRollout'),
      task: async () => {
        await waitForRollout(options.ns ?? options.name, options.name)
        if (options.expose) {
          nodePort = await getServiceNodePort(options.ns ?? options.name, options.name)
        }
      },
    },
  ])

  await tasks.run()

  if (options.expose && nodePort) {
    success(t('deploy.successExposed', { name: options.name, port: nodePort }))
  } else {
    success(t('deploy.success', { name: options.name }))
  }

  info(t('deploy.nextSteps.0', { namespace: options.ns ?? options.name }))
  info(t('deploy.nextSteps.1', { name: options.name, namespace: options.ns ?? options.name }))
}
