import {
  resolveLocalSource,
  isGitUrl,
  resolveGitSource,
  cleanupSource,
} from './source.js';
import {detectBuildStrategy, buildImage} from './build.js';
import {buildTag, buildPushTag, pushImage, REGISTRY_HOST, getRegistryPushHost} from './push.js';
import {hashSourceDir} from './hash.js';
import {
  buildConfigMap,
  buildSecret,
  buildDeployment,
  buildDeployment,
  buildService,
  buildHPA,
  assembleManifests,
} from './manifest.js';
import {
  applyManifests,
  waitForRollout,
  getServiceNodePort,
} from './apply.js';
import {
  helmInstall,
  createHelmExposureService,
  helmReleaseImage,
} from './helm.js';
import {getDeployedImage} from './apply.js';
import {checkDependency} from '../utils/checks.js';
import {info, success, warn, step, error} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import type {AppEntry, DeployContext} from '../types/index.js';
import {topoSortApps, appNamespace, appDeploymentName, buildVars, interpolate} from './deps.js';
import {waitForDependency} from './wait-deps.js';
import {ensureNamespace} from './apply.js';
import {ensurePullSecret} from './registry.js';
import {exec} from '../utils/exec.js';

export interface DeployResult {
  name: string;
  url: string | null;
}

function buildExposureUrl(nodeIp: string | undefined, nodePort: number): string {
  if (nodeIp) {
    return `http://${nodeIp}:${nodePort}`;
  }
  return `NodePort ${nodePort} (run: kubectl port-forward svc/<name> ${nodePort}:${nodePort} -n <namespace>)`;
}

async function deployFromImage(
  app: AppEntry,
  ctx: DeployContext,
  image: string,
  url: string | null,
): Promise<DeployResult> {
  const effectiveName = appDeploymentName(app);
  // Interpolate ${VAR} / ${app.endpoint} / ${component.output} refs (P1).
  const vars = {
    ...buildVars(ctx.allApps ?? [], ctx.namespace),
    ...(ctx.componentOutputs ?? {}),
  };
  const env: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(app.env ?? {})) {
    env[k] = interpolate(v, vars);
  }
  for (const [k, v] of Object.entries(app.secret ?? {})) {
    secrets[k] = interpolate(v, vars);
  }
  const replicas = app.ha ? 2 : (app.replicas ?? 1);
  const port = typeof app.port === 'number' ? app.port : 80;
  // Private registry (idea 6): ensure an imagePullSecret in the namespace so
  // the cluster can pull the image; attach it to the Deployment.
  let imagePullSecrets: string[] | undefined;
  if (app.registry?.server && app.registry.username) {
    const secretName = await ensurePullSecret(app, ctx.namespace, ctx.clusterName);
    if (secretName) imagePullSecrets = [secretName];
  }

  const opts = {
    name: effectiveName,
    namespace: ctx.namespace,
    image,
    port,
    replicas,
    env,
    secret: secrets,
    expose: app.exposed ?? false,
    healthcheck: app.healthcheck,
    ha: app.ha ?? false,
    command: app.command,
    args: app.args,
    resources: app.resources,
    patch: app.patch,
    imagePullSecrets,
  };

  info(`[${app.name}] ${t('deploy.generatingManifests')}`);
  const cm = buildConfigMap(effectiveName, ctx.namespace, env);
  const secretManifest = buildSecret(effectiveName, ctx.namespace, secrets);
  const deployment = buildDeployment(opts);
  const service = buildService(opts);
  const hpa = app.ha ? buildHPA(opts) : null;

  const manifestYaml = assembleManifests([cm, secretManifest, deployment, service, hpa]);
  info(`[${app.name}] ${t('deploy.manifestsGenerated')}`);

  info(`[${app.name}] ${t('deploy.applyingManifests')}`);
  await applyManifests(manifestYaml, ctx.clusterName);
  info(`[${app.name}] ${t('deploy.manifestsApplied')}`);

  info(`[${app.name}] ${t('deploy.waitingRollout')}`);
  await waitForRollout(effectiveName, ctx.namespace, ctx.clusterName);
  info(`[${app.name}] ${t('deploy.rolloutComplete')}`);

  let finalUrl = url;
  if (app.exposed) {
    const nodePort = await getServiceNodePort(effectiveName, ctx.namespace, ctx.clusterName);
    if (nodePort) {
      finalUrl = buildExposureUrl(ctx.nodeIp, nodePort);
    }
  }
  return {name: app.name, url: finalUrl};
}

interface BuiltImage {
  ref: string;
  image: string;
}

/**
 * BUILD PHASE (idea 1: split build from deploy).
 *
 * Resolves the source, computes the deterministic content-hash ref, and
 * builds + pushes unless `skipCheck` reports the exact image is already in
 * the cluster. Returns the in-cluster image reference, which any deploy
 * target (builtin template, helm chart) can then consume.
 */
async function buildSourceImage(
  app: AppEntry,
  ctx: DeployContext,
  skipCheck: (image: string, ref: string) => Promise<boolean>,
): Promise<BuiltImage> {
  let sourcePath: string | undefined;
  let cloned = false;

  try {
    if (isGitUrl(app.source!)) {
      info(`[${app.name}] ${t('deploy.cloningRepo')}`);
      sourcePath = await resolveGitSource(app.source!);
      cloned = true;
      info(`[${app.name}] ${t('deploy.repoCloned')}`);
    } else {
      info(`[${app.name}] ${t('deploy.resolvingSource')}`);
      sourcePath = await resolveLocalSource(app.source!);
      info(`[${app.name}] ${t('deploy.sourceResolved')}`);
    }

    const ref = await hashSourceDir(sourcePath);
    info(`[${app.name}] ${t('deploy.sourceHash', {ref})}`);
    const pushTag = buildPushTag(app.name, ref, ctx.registryPort);
    const image = buildTag(app.name, ref);

    if (await skipCheck(image, ref)) {
      info(`[${app.name}] ${t('deploy.upToDate', {ref})}`);
      return {ref, image};
    }

    info(`[${app.name}] ${t('deploy.detectingStrategy')}`);
    const strategy = await detectBuildStrategy(sourcePath);
    info(`[${app.name}] ${t('deploy.strategyDetected', {strategy})}`);

    if (strategy === 'railpack') {
      const railpackCheck = await checkDependency('railpack');
      if (!railpackCheck.present) {
        error(t('errors.railpackMissing'));
        throw new Error(t('errors.railpackMissing'));
      }
    }

    info(`[${app.name}] ${t('deploy.buildingImage')}`);
    await buildImage(sourcePath, pushTag, strategy);
    info(`[${app.name}] ${t('deploy.imageBuilt')}`);

    info(`[${app.name}] ${t('deploy.pushingImage')}`);
    await pushImage(pushTag, getRegistryPushHost(ctx.registryPort));
    info(`[${app.name}] ${t('deploy.imagePushed')}`);

    return {ref, image};
  } finally {
    if (cloned && sourcePath) {
      await cleanupSource(sourcePath).catch(() => {});
    }
  }
}

// DEPLOY TARGET: builtin template (ConfigMap + Deployment + Service + HPA).
// Deploy target stays the builtin template when neither images/helm apply.
async function deploySourceApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
  const {image} = await buildSourceImage(app, ctx, async (image) => {
    const deployedImage = await getDeployedImage(app.name, ctx.namespace, ctx.clusterName);
    return deployedImage === image;
  });
  return await deployFromImage(app, ctx, image, url);
}

async function deployImageApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
  return await deployFromImage(app, ctx, app.image!, url);
}

// DEPLOY TARGET: helm chart that owns the Deployment/Service itself.
// Used by plain helm apps, image + helm, and source + helm (idea 1: the
// built image is injected into the chart via helm.imageValues).
async function deployHelmApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
  imageOverride?: string,
): Promise<DeployResult> {
  info(`[${app.name}] ${t('deploy.installingHelm')}`);
  await helmInstall(app, ctx.namespace, ctx.clusterName, imageOverride);
  info(`[${app.name}] ${t('deploy.helmInstalled')}`);

  let finalUrl = url;
  if (app.exposed && typeof app.port === 'number' && app.helm?.selector) {
    info(`[${app.name}] ${t('deploy.creatingExposureService')}`);
    const serviceYaml = createHelmExposureService(
      app.name,
      ctx.namespace,
      app.port,
      app.helm.selector,
    );
    await applyManifests(serviceYaml, ctx.clusterName);
    info(`[${app.name}] ${t('deploy.exposureServiceCreated')}`);

    const nodePort = await getServiceNodePort(app.name, ctx.namespace, ctx.clusterName);
    if (nodePort) {
      finalUrl = buildExposureUrl(ctx.nodeIp, nodePort);
    }
  } else if (app.exposed) {
    warn(t('deploy.helmExposureWarning', {name: app.name}));
  }

  return {name: app.name, url: finalUrl};
}

/** source + helm: build the image, then let the chart own the deploy. */
async function deploySourceAsHelmApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
  const {image} = await buildSourceImage(app, ctx, async (image) => {
    const releaseImage = await helmReleaseImage(app, ctx.namespace, ctx.clusterName);
    return releaseImage === image;
  });
  return await deployHelmApp(app, ctx, url, image);
}

export async function deployApp(
  app: AppEntry,
  ctx: DeployContext,
): Promise<DeployResult> {
  step(t('deploy.starting', {name: app.name}));

  const url = null;

  try {
    if (app.helm) {
      if (app.source) {
        return await deploySourceAsHelmApp(app, ctx, url);
      }
      if (app.image) {
        return await deployHelmApp(app, ctx, url, app.image);
      }
      return await deployHelmApp(app, ctx, url);
    }

    if (app.image) {
      return await deployImageApp(app, ctx, url);
    }

    if (app.source) {
      return await deploySourceApp(app, ctx, url);
    }

    throw new Error(
      `App '${app.name}' has no source, image, or helm configuration.`,
    );
  } catch (err) {
    error(`[${app.name}] ${t('deploy.failed', {name: app.name})}`);
    throw err;
  }
}

async function runHooks(
  hooks: string[] | undefined,
  kind: 'pre' | 'post',
  appName: string,
): Promise<void> {
  if (!hooks || hooks.length === 0) return;
  for (const hook of hooks) {
    info(`[${appName}] ${kind}-hook: ${hook}`);
    await exec('sh', ['-c', hook]);
  }
}

/**
 * Deploy one app with ordering + hooks (idea 3 + idea 4).
 */
async function deployAppWithDeps(
  app: AppEntry,
  ctx: DeployContext,
): Promise<DeployResult> {
  const effectiveName = appDeploymentName(app);
  const ns = appNamespace(app, ctx.namespace);
  // Per-app namespace (idea 7): derive a context targeting the app's own
  // namespace, so every kubectl/helm call below uses it without changing
  // their signatures.
  const appCtx: DeployContext = {...ctx, namespace: ns};

  await ensureNamespace(ns, ctx.clusterName);
  await runHooks(app.hooks?.pre, 'pre', effectiveName);

  for (const dep of app.dependsOn ?? []) {
    step(t('deploy.waitingDep', {dep, name: effectiveName}));
    const depNs = app.wait?.namespace ?? ns;
    await waitForDependency(dep, depNs, ctx.clusterName, app.wait);
  }

  const result = await deployApp(app, appCtx);

  await runHooks(app.hooks?.post, 'post', effectiveName);
  return result;
}

export async function deployAll(
  apps: AppEntry[],
  ctx: DeployContext,
): Promise<DeployResult[]> {
  const ordered = topoSortApps(apps);
  const results: DeployResult[] = [];

  for (const app of ordered) {
    const result = await deployAppWithDeps(app, ctx);
    results.push(result);
  }

  success(t('deploy.summaryHeader'));
  for (const r of results) {
    const status = r.url ? `${r.name}  →  ${r.url}` : `${r.name}  →  internal`;
    info(status);
  }

  return results;
}
