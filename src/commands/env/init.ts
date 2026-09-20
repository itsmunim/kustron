import {access} from 'fs/promises';
import {basename} from 'path';
import {error, success, info as infoLog, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';
import {createEnvFile} from '../../core/env-file.js';
import {checkAll} from '../../utils/checks.js';

function toKebabCase(str: string): string {
  return str.replace(/[\s_.]+/g, '-').toLowerCase();
}

export async function envInit(): Promise<void> {
  const filePath = './kustron-env.yaml';

  // Always check dependencies — this is the main purpose of env init
  try {
    await checkAll(
      ['container-runtime', 'k3d', 'kubectl'],
      ['helm', 'railpack', 'docker', 'git'],
    );
  } catch {
    warn(t('env.init.missingDependencies'));
  }

  // Create env file if it doesn't exist, otherwise skip silently
  try {
    await access(filePath);
    infoLog(t('env.init.alreadyExists'));
  } catch {
    const folderName = basename(process.cwd());
    const appName = toKebabCase(folderName);

    await createEnvFile(filePath, {
      name: appName,
      source: './',
      port: 'PORT',
      exposed: false,
    });

    success(t('env.init.created', {file: filePath}));
    infoLog(t('env.init.nextStep'));
  }
}
