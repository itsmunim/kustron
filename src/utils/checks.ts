import { execa } from 'execa'
import chalk from 'chalk'
import { error, warn, info, success } from './logger.js'
import { t } from './i18n.js'

export interface Dependency {
  name: string
  command: string
  required: boolean
  installHint: string
  url?: string
}

const dependencies: Dependency[] = [
  {
    name: 'docker',
    command: 'docker',
    required: true,
    installHint: 'Install OrbStack (https://orbstack.dev) or Docker Desktop',
    url: 'https://orbstack.dev',
  },
  {
    name: 'k3d',
    command: 'k3d',
    required: true,
    installHint: 'brew install k3d',
    url: 'https://k3d.io/installation',
  },
  {
    name: 'kubectl',
    command: 'kubectl',
    required: true,
    installHint: 'brew install kubectl',
  },
  {
    name: 'railpack',
    command: 'railpack',
    required: false,
    installHint: 'See https://railpack.io',
    url: 'https://railpack.io',
  },
  {
    name: 'git',
    command: 'git',
    required: false,
    installHint: 'Usually pre-installed; otherwise brew install git',
  },
  {
    name: 'buildkit',
    command: 'buildctl',
    required: false,
    installHint: 'docker run --rm --privileged -d --name buildkit moby/buildkit',
  },
]

async function isInstalled(command: string): Promise<boolean> {
  const result = await execa('which', [command], { reject: false })
  return result.exitCode === 0
}

export async function runChecks(): Promise<boolean> {
  info(t('checks.header'))

  const results = await Promise.all(
    dependencies.map(async (dep) => {
      const installed = await isInstalled(dep.command)
      return { dep, installed }
    }),
  )

  const maxNameLen = Math.max(...dependencies.map((d) => d.name.length))
  const maxStatusLen = 10

  console.log()
  console.log(
    `${chalk.bold(t('checks.dependencyColumn').padEnd(maxNameLen + 2))}${chalk.bold(t('checks.statusColumn').padEnd(maxStatusLen + 2))}${chalk.bold(t('checks.installHintColumn'))}`,
  )
  console.log(chalk.dim(t('checks.divider').repeat(80)))

  let hasMissingRequired = false

  for (const { dep, installed } of results) {
    const status = installed
      ? chalk.green(t('checks.installed').padEnd(maxStatusLen))
      : dep.required
        ? chalk.red(t('checks.missingRequired').padEnd(maxStatusLen))
        : chalk.yellow(t('checks.missingOptional').padEnd(maxStatusLen))

    console.log(
      `${dep.name.padEnd(maxNameLen + 2)}${status.padEnd(maxStatusLen + 2)}${chalk.dim(dep.installHint)}`,
    )

    if (!installed && dep.required) {
      hasMissingRequired = true
    }
  }

  console.log()

  if (hasMissingRequired) {
    error(t('checks.missingRequiredError'))
    return false
  }

  const missingOptional = results.filter((r) => !r.installed && !r.dep.required)
  if (missingOptional.length > 0) {
    warn(
      t('checks.optionalMissing', {
        deps: missingOptional.map((r) => r.dep.name).join(', '),
      }),
    )
  }

  success(t('checks.allRequiredInstalled'))
  return true
}

export async function checkCommandAvailable(command: string): Promise<boolean> {
  return isInstalled(command)
}

export async function checkDockerRunning(): Promise<boolean> {
  try {
    await execa('docker', ['info'], { reject: false })
    return true
  } catch {
    return false
  }
}
