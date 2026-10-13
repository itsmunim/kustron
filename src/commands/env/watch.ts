import {access} from 'fs/promises';
import {watch} from 'chokidar';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {envUp} from './up.js';
import {info, step, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';
import {isGitUrl} from '../../core/source.js';

const DEFAULT_CLUSTER_NAME = 'kustron';

export async function envWatch(): Promise<void> {
  const filePath = './kustron-env.yaml';
  try {
    await access(filePath);
  } catch {
    warn(t('env.up.noEnvFile'));
    process.exit(1);
  }

  const envFile = await readAndParseEnvFile(filePath);
  const clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;

  // Collect local source directories to watch
  const sourcesToWatch: string[] = [];
  for (const app of envFile.apps) {
    if (app.source && !isGitUrl(app.source)) {
      sourcesToWatch.push(app.source);
    }
  }

  if (sourcesToWatch.length === 0) {
    warn(t('env.watch.noLocalSources'));
    return;
  }

  step(
    t('env.watch.starting', {
      count: String(sourcesToWatch.length),
      sources: sourcesToWatch.join(', '),
    }),
  );

  // Initial up
  await envUp();

  const watcher = watch(sourcesToWatch, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watcher.on('all', (event, path) => {
    info(t('env.watch.changeDetected', {event, path}));

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      step(t('env.watch.reloading'));
      try {
        await envUp();
        info(t('env.watch.ready'));
      } catch (err) {
        warn(t('env.watch.reloadFailed', {error: String(err)}));
      }
    }, 500);
  });

  // Keep process alive
  await new Promise(() => {});
}
