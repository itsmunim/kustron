import { exec } from '../utils/exec.js'
import { dump } from 'js-yaml'
import type { AppEntry } from '../types/index.js'

export async function helmInstall(app: AppEntry, namespace: string): Promise<void> {
  if (!app.helm) throw new Error('App has no helm configuration')

  const args = [
    'upgrade',
    '--install',
    app.name,
    app.helm.chart,
    '--namespace',
    namespace,
    '--create-namespace',
    '--wait',
  ]

  if (app.helm.repo) {
    await exec('helm', ['repo', 'add', `kustron-${app.name}`, app.helm.repo])
    await exec('helm', ['repo', 'update'])
  }

  if (app.helm.version) {
    args.push('--version', app.helm.version)
  }

  if (app.helm.values) {
    for (const [key, value] of Object.entries(app.helm.values)) {
      args.push('--set', `${key}=${value}`)
    }
  }

  await exec('helm', args)
}

export async function helmUninstall(appName: string, namespace: string): Promise<void> {
  try {
    await exec('helm', ['uninstall', appName, '--namespace', namespace])
  } catch {
    // ignore if not installed
  }
}

export async function isHelmRelease(appName: string, namespace: string): Promise<boolean> {
  try {
    const { stdout } = await exec('helm', ['list', '-n', namespace, '-o', 'json'])
    const releases = JSON.parse(stdout) as Array<{ name: string }>
    return releases.some((r) => r.name === appName)
  } catch {
    return false
  }
}

export function createHelmExposureService(
  name: string,
  namespace: string,
  port: number,
  selector: Record<string, string>,
): string {
  return dump({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/managed-by': 'kustron',
      },
    },
    spec: {
      type: 'LoadBalancer',
      selector,
      ports: [
        {
          port,
          targetPort: port,
        },
      ],
    },
  })
}
