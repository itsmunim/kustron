import type {AppEntry, EnvFile} from '../types/index.js';
import {appDeploymentName} from './deps.js';
import {expandComponents} from './components.js';

export interface ResolvedApp {
  app: AppEntry;
  /** Deployment/helm release name: `<name>` or `<name>-<instance>`. */
  deploymentName: string;
  /** Namespace this app deploys into (per-app override or the env default). */
  namespace: string;
}

/**
 * Resolve an app by name across the environment, including apps that only
 * exist after components are expanded (component apps are addressable by
 * their prefixed name in every lifecycle command).
 */
export async function resolveAppByName(
  envFile: EnvFile,
  appName: string,
  defaultNamespace: string,
): Promise<ResolvedApp | undefined> {
  const {apps} = await expandComponents(envFile);
  const app = apps.find((a) => a.name === appName);
  if (!app) return undefined;
  return {
    app,
    deploymentName: appDeploymentName(app),
    namespace: app.namespace ?? defaultNamespace,
  };
}
