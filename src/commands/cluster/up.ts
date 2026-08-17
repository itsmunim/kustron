import { runChecks, checkDockerRunning } from '../../utils/checks.js'
import { createCluster } from '../../core/cluster.js'
import { importKubeconfig, setCurrentContext } from '../../core/context.js'
import { info, success, error, step } from '../../utils/logger.js'

const DEFAULT_CLUSTER_NAME = 'kustron-k3d'

export async function clusterUp(): Promise<void> {
  const checksPassed = await runChecks()
  if (!checksPassed) {
    process.exit(1)
  }

  const dockerRunning = await checkDockerRunning()
  if (!dockerRunning) {
    error('Docker does not appear to be running. Start Docker/OrbStack and try again.')
    process.exit(1)
  }

  step(`Creating cluster ${DEFAULT_CLUSTER_NAME}...`)
  await createCluster()

  step('Importing kubeconfig...')
  await importKubeconfig()

  step('Setting kubectl context...')
  await setCurrentContext()

  success(`Cluster '${DEFAULT_CLUSTER_NAME}' is up and running!`)
  info("Run 'kubectl get nodes' to verify")
  info("Run 'kustron deploy <source> --name <app> --port <port>' to deploy an app")
}
