import {execa} from 'execa';
import chalk from 'chalk';
import {error, warn, info, success} from './logger.js';
import {t} from './i18n.js';

export interface Dependency {
  name: string;
  command: string;
  required: boolean;
  installHint: string;
  url?: string;
}

const dependencies: Dependency[] = [
  {
    name: 'container-runtime',
    command: 'podman',
    required: true,
    installHint: 'Podman (https://podman.io) or Docker',
    url: 'https://podman.io/getting-started/installation',
  },
  {
    name: 'docker',
    command: 'docker',
    required: false,
    installHint: 'Used by k3d under the hood; install podman-docker if using Podman',
    url: 'https://podman.io',
  },
  {
    name: 'k3d',
    command: 'k3d',
    required: true,
    installHint: 'https://k3d.io/v5.7.4/#installation',
    url: 'https://k3d.io/v5.7.4/#installation',
  },
  {
    name: 'kubectl',
    command: 'kubectl',
    required: true,
    installHint: 'https://kubernetes.io/docs/tasks/tools/',
    url: 'https://kubernetes.io/docs/tasks/tools/',
  },
  {
    name: 'helm',
    command: 'helm',
    required: false,
    installHint: 'https://helm.sh/docs/intro/install/',
    url: 'https://helm.sh/docs/intro/install/',
  },
  {
    name: 'railpack',
    command: 'railpack',
    required: false,
    installHint: 'https://railpack.io',
    url: 'https://railpack.io',
  },
  {
    name: 'git',
    command: 'git',
    required: false,
    installHint: 'Usually pre-installed; otherwise https://git-scm.com/downloads',
    url: 'https://git-scm.com/downloads',
  },
];

async function isInstalled(command: string): Promise<boolean> {
  const result = await execa('which', [command], {reject: false});
  return result.exitCode === 0;
}

async function isRuntimeInstalled(): Promise<boolean> {
  // container-runtime is satisfied by either podman or docker (or the
  // podman-docker shim that provides a docker binary)
  return isInstalled('podman') || isInstalled('docker');
}

export async function checkDependency(
  name: string,
): Promise<{present: boolean; path?: string}> {
  const dep = dependencies.find((d) => d.name === name);
  if (!dep) {
    return {present: false};
  }
  const installed =
    name === 'container-runtime' ? await isRuntimeInstalled() : await isInstalled(dep.command);
  return {present: installed};
}

export async function checkAll(
  required: string[],
  optional: string[],
): Promise<void> {
  info(t('checks.header'));

  const names = [...required, ...optional];
  const deps = dependencies.filter((d) => names.includes(d.name));

  const results = await Promise.all(
    deps.map(async (dep) => {
      const installed =
        dep.name === 'container-runtime'
          ? await isRuntimeInstalled()
          : await isInstalled(dep.command);
      return {dep, installed};
    }),
  );

  const maxNameLen = Math.max(...deps.map((d) => d.name.length));
  const maxStatusLen = 10;

  console.log();
  console.log(
    `${chalk.bold(t('checks.dependencyColumn').padEnd(maxNameLen + 2))}${chalk.bold(t('checks.statusColumn').padEnd(maxStatusLen + 2))}${chalk.bold(t('checks.installHintColumn'))}`,
  );
  console.log(chalk.dim(t('checks.divider').repeat(80)));

  let hasMissingRequired = false;

  for (const {dep, installed} of results) {
    const isReq = required.includes(dep.name);
    const status = installed
      ? chalk.green(t('checks.installed').padEnd(maxStatusLen))
      : isReq
        ? chalk.red(t('checks.missingRequired').padEnd(maxStatusLen))
        : chalk.yellow(t('checks.missingOptional').padEnd(maxStatusLen));

    console.log(
      `${dep.name.padEnd(maxNameLen + 2)}${status.padEnd(maxStatusLen + 2)}${chalk.dim(dep.installHint)}`,
    );

    if (!installed && isReq) {
      hasMissingRequired = true;
    }
  }

  console.log();

  if (hasMissingRequired) {
    throw new Error(t('checks.missingRequiredError'));
  }

  const missingOptional = results.filter(
    (r) => !r.installed && optional.includes(r.dep.name),
  );
  if (missingOptional.length > 0) {
    warn(
      t('checks.optionalMissing', {
        deps: missingOptional.map((r) => r.dep.name).join(', '),
      }),
    );
  }

  success(t('checks.allRequiredInstalled'));
}

