import {
  resolveLocalSource,
  isGitUrl,
  resolveGitSource,
  cleanupSource,
} from './source.js';
import {detectBuildStrategy, buildImage} from './build.js';
import {buildTag, buildPushTag, pushImage, REGISTRY_HOST} from './push.js';
import {hashSourceDir} from './hash.js';
import {
  buildConfigMap,
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
import {helmInstall, createHelmExposureService} from './helm.js';
import {getDeployedImage} from './apply.js';
import {checkDependency} from '../utils/checks.js';
import {info, success, warn, step, error} from '../utils/logger.js';
import {t} from '../utils/i18n.js';
import type {AppEntry, DeployContext} from '../types/index.js';

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
  const env = app.env ?? {};
  const replicas = app.ha ? 2 : (app.replicas ?? 1);
  const port = typeof app.port === 'number' ? app.port : 80;

  const opts = {
    name: app.name,
    namespace: ctx.namespace,
    image,
    port,
    replicas,
    env,
    expose: app.exposed ?? false,
    healthcheck: app.healthcheck,
  };

  info(`[${app.name}] ${t('deploy.generatingManifests')}`);
  const cm = buildConfigMap(app.name, ctx.namespace, env);
  const deployment = buildDeployment(opts);
  const service = buildService(opts);
  const hpa = app.ha ? buildHPA(opts) : null;

  const manifestYaml = assembleManifests([cm, deployment, service, hpa]);
  info(`[${app.name}] ${t('deploy.manifestsGenerated')}`);

  info(`[${app.name}] ${t('deploy.applyingManifests')}`);
  await applyManifests(manifestYaml);
  info(`[${app.name}] ${t('deploy.manifestsApplied')}`);

  info(`[${app.name}] ${t('deploy.waitingRollout')}`);
  try {
    await waitForRollout(app.name, ctx.namespace);
    info(`[${app.name}] ${t('deploy.rolloutComplete')}`);
  } catch (rolloutErr) {
    throw rolloutErr;
  }

  let finalUrl = url;
  if (app.exposed) {
    const nodePort = await getServiceNodePort(app.name, ctx.namespace);
    if (nodePort) {
      finalUrl = buildExposureUrl(ctx.nodeIp, nodePort);
    }
  }
  return {name: app.name, url: finalUrl};
}

async function deploySourceApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
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

    // Deterministic image ref: content hash of the source tree. Unchanged
    // source -> same tag -> nothing to rebuild or redeploy.
    const ref = await hashSourceDir(sourcePath);
    info(`[${app.name}] ${t('deploy.sourceHash', {ref})}`);
    const pushTag = buildPushTag(app.name, ref);
    const manifestImage = buildTag(app.name, ref);

    // Image already running: skip the build + push entirely. `kubectl apply`
    // below is still a no-op for unchanged manifests, but picks up yaml-only
    // changes (env, replicas, exposure) when they happen.
    const deployedImage = await getDeployedImage(app.name, ctx.namespace);
    if (deployedImage === manifestImage) {
      info(`[${app.name}] ${t('deploy.upToDate', {ref})}`);
      return await deployFromImage(app, ctx, manifestImage, url);
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
    await pushImage(pushTag);
    info(`[${app.name}] ${t('deploy.imagePushed')}`);

    return await deployFromImage(app, ctx, manifestImage, url);
  } finally {
    if (cloned && sourcePath) {
      await cleanupSource(sourcePath).catch(() => {});
    }
  }
}

async function deployImageApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
  return await deployFromImage(app, ctx, app.image!, url);
}

async function deployHelmApp(
  app: AppEntry,
  ctx: DeployContext,
  url: string | null,
): Promise<DeployResult> {
  info(`[${app.name}] ${t('deploy.installingHelm')}`);
  await helmInstall(app, ctx.namespace);
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
    await applyManifests(serviceYaml);
    info(`[${app.name}] ${t('deploy.exposureServiceCreated')}`);

    const nodePort = await getServiceNodePort(app.name, ctx.namespace);
    if (nodePort) {
      finalUrl = buildExposureUrl(ctx.nodeIp, nodePort);
    }
  } else if (app.exposed) {
    warn(t('deploy.helmExposureWarning', {name: app.name}));
  }

  return {name: app.name, url: finalUrl};

}

export async function deployApp(
  app: AppEntry,
  ctx: DeployContext,
): Promise<DeployResult> {
  step(t('deploy.starting', {name: app.name}));

  const url = null;

  try {
    if (app.helm) {
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

export async function deployAll(
  apps: AppEntry[],
  ctx: DeployContext,
): Promise<DeployResult[]> {
  const results: DeployResult[] = [];

  for (const app of apps) {
    const result = await deployApp(app, ctx);
    results.push(result);
  }

  success(t('deploy.summaryHeader'));
  for (const r of results) {
    const status = r.url ? `${r.name}  →  ${r.url}` : `${r.name}  →  internal`;
    info(status);
  }

  return results;
}
