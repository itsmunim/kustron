import chalk from 'chalk';
import {checkAll, collectDependencies} from '../utils/checks.js';
import {checkContainerRuntimeRunning} from '../utils/container-runtime.js';
import {getPackageVersion} from '../utils/version.js';
import {error, info, success, warn} from '../utils/logger.js';
import {t} from '../utils/i18n.js';

const REQUIRED_DEPS = ['container-runtime', 'k3d', 'kubectl'];
const OPTIONAL_DEPS = ['docker', 'helm', 'railpack', 'git'];

/**
 * kustron doctor — checks that every runtime dependency kustron needs is
 * installed, verifies the container runtime daemon is reachable, and prints
 * install hints + exit code 1 for anything missing.
 *
 * With --json: prints one machine-readable object and nothing else — same
 * exit-code semantics (1 when any required dependency or the daemon is
 * unavailable).
 */
export async function runDoctor(options: {json?: boolean} = {}): Promise<void> {
  const json = options.json === true;

  if (json) {
    const checks = await collectDependencies(REQUIRED_DEPS, OPTIONAL_DEPS);
    const daemonReachable = await checkContainerRuntimeRunning();
    const healthy =
      checks.every((c) => c.installed || !c.required) && daemonReachable;

    console.log(
      JSON.stringify(
        {
          version: getPackageVersion(),
          node: process.version,
          healthy,
          daemonReachable,
          checks: checks.map((c) => ({
            name: c.dep.name,
            required: c.required,
            present: c.installed,
            installHint: c.dep.installHint,
          })),
        },
        null,
        2,
      ),
    );
    process.exitCode = healthy ? 0 : 1;
    return;
  }

  info(
    chalk.dim(
      t('doctor.versionLine', {
        version: getPackageVersion(),
        node: process.version,
      }),
    ),
  );

  let healthy = true;

  try {
    await checkAll(REQUIRED_DEPS, OPTIONAL_DEPS);
  } catch {
    // checkAll already printed the dependency table + install hints
    healthy = false;
  }

  info(t('doctor.daemonChecking'));
  if (await checkContainerRuntimeRunning()) {
    success(t('doctor.daemonRunning'));
  } else {
    error(t('doctor.daemonNotRunning'));
    warn(t('doctor.daemonHint'));
    healthy = false;
  }

  if (!healthy) {
    error(t('doctor.summaryFail'));
    warn(t('doctor.summaryHint'));
    process.exitCode = 1;
  } else {
    success(t('doctor.summaryOk'));
  }
}
