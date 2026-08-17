import { runChecks, checkDockerRunning } from '../../utils/checks.js'
import { createCluster } from '../../core/cluster.js'
import { importKubeconfig, setCurrentContext } from '../../core/context.js'
import { exec } from '../../utils/exec.js'
import { info, success, error, step } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'

const DEFAULT_CLUSTER_NAME = 'kustron'

export async function clusterUp(): Promise<void> {
  const checksPassed = await runChecks()
  if (!checksPassed) {
    process.exit(1)
  }

  const dockerRunning = await checkDockerRunning()
  if (!dockerRunning) {
    error(t('errors.dockerNotRunning'))
    process.exit(1)
  }

  step(t('cluster.up.creating', { name: DEFAULT_CLUSTER_NAME }))
  await createCluster()

  step(t('cluster.up.importingKubeconfig'))
  await importKubeconfig()

  step(t('cluster.up.settingContext'))
  await setCurrentContext()

  step(t('cluster.up.installingMetricsServer'))
  await installMetricsServer()

  success(t('cluster.up.success', { name: DEFAULT_CLUSTER_NAME }))
  info(t('cluster.up.nextSteps.0'))
  info(t('cluster.up.nextSteps.1'))
}

async function installMetricsServer(): Promise<void> {
  await exec('kubectl', [
    'apply',
    '-f',
    'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
  ])

  // Patch metrics-server to work with k3d self-signed certificates
  await exec('kubectl', [
    'patch',
    'deployment',
    'metrics-server',
    '-n',
    'kube-system',
    '--type',
    'json',
    '-p',
    '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]',
  ])
}

