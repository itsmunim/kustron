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
    name: 'helm',
    command: 'helm',
    required: false,
    installHint: 'brew install helm',
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
]

async function isInstalled(command: string): Promise<boolean> {
  const result = await execa('which', [command], { reject: false })
  return result.exitCode === 0
}

export async function checkDependency(name: string): Promise<{ present: boolean; path?: string }> {
  const dep = dependencies.find((d) => d.name === name)
  if (!dep) {
    return { present: false }
  }
  const installed = await isInstalled(dep.command)
  return { present: installed }
}

export async function checkAll(required: string[], optional: string[]): Promise<void> {
  info(t('checks.header'))

  const names = [...required, ...optional]
  const deps = dependencies.filter((d) => names.includes(d.name))

  const results = await Promise.all(
    deps.map(async (dep) => {
      const installed = await isInstalled(dep.command)
      return { dep, installed }
    }),
  )

  const maxNameLen = Math.max(...deps.map((d) => d.name.length))
  const maxStatusLen = 10

  console.log()
  console.log(
    `${chalk.bold(t('checks.dependencyColumn').padEnd(maxNameLen + 2))}${chalk.bold(t('checks.statusColumn').padEnd(maxStatusLen + 2))}${chalk.bold(t('checks.installHintColumn'))}`,
  )
  console.log(chalk.dim(t('checks.divider').repeat(80)))

  let hasMissingRequired = false

  for (const { dep, installed } of results) {
    const isReq = required.includes(dep.name)
    const status = installed
      ? chalk.green(t('checks.installed').padEnd(maxStatusLen))
      : isReq
        ? chalk.red(t('checks.missingRequired').padEnd(maxStatusLen))
        : chalk.yellow(t('checks.missingOptional').padEnd(maxStatusLen))

    console.log(`${dep.name.padEnd(maxNameLen + 2)}${status.padEnd(maxStatusLen + 2)}${chalk.dim(dep.installHint)}`)

    if (!installed && isReq) {
      hasMissingRequired = true
    }
  }

  console.log()

  if (hasMissingRequired) {
    throw new Error(t('checks.missingRequiredError'))
  }

  const missingOptional = results.filter((r) => !r.installed && optional.includes(r.dep.name))
  if (missingOptional.length > 0) {
    warn(t('checks.optionalMissing', { deps: missingOptional.map((r) => r.dep.name).join(', ') }))
  }

  success(t('checks.allRequiredInstalled'))
}

export async function checkDockerRunning(): Promise<boolean> {
  try {
    await execa('docker', ['info'], { reject: false })
    return true
  } catch {
    return false
  }
}
