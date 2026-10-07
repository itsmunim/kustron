import {readFile, writeFile, mkdir} from 'fs/promises';
import {existsSync} from 'fs';
import {join} from 'path';
import {kubectl} from './kubectl.js';
import {helmUninstall} from './helm.js';
import type {AppEntry} from '../types/index.js';

const STATE_DIR = '.kustron';
const STATE_FILE = join(STATE_DIR, 'state.json');

interface KustronState {
  apps: Array<{name: string; namespace: string; helm?: boolean}>;
}

async function loadState(): Promise<KustronState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as KustronState;
  } catch {
    return {apps: []};
  }
}

async function saveState(state: KustronState): Promise<void> {
  if (!existsSync(STATE_DIR)) {
    await mkdir(STATE_DIR, {recursive: true});
  }
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function pruneRemovedApps(
  currentApps: AppEntry[],
  namespace: string,
  clusterName: string,
): Promise<void> {
  const previous = await loadState();
  const currentNames = new Set(currentApps.map((a) => a.name));

  for (const prev of previous.apps) {
    if (currentNames.has(prev.name)) continue;

    // App was removed from the env file — clean it up
    if (prev.helm) {
      await helmUninstall(prev.name, prev.namespace ?? namespace, clusterName);
    } else {
      try {
        await kubectl(
          clusterName,
          [
            'delete',
            'deployment,service,configmap,hpa',
            '-l',
            `app.kubernetes.io/name=${prev.name}`,
            '-n',
            prev.namespace ?? namespace,
          ],
          {silent: true, reject: false},
        );
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export async function recordDeployedApps(
  apps: AppEntry[],
  namespace: string,
): Promise<void> {
  const state: KustronState = {
    apps: apps.map((app) => ({
      name: app.name,
      namespace: app.namespace ?? namespace,
      helm: !!app.helm,
    })),
  };
  await saveState(state);
}
