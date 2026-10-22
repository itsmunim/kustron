import {writeFile} from 'fs/promises';
import {existsSync} from 'fs';
import {basename} from 'path';
import {text, select, confirm, isCancel} from '@clack/prompts';
import {success, warn, error, info} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

export interface InitFlags {
  name?: string;
  port?: number;
  image?: string;
  source?: string;
  exposed?: boolean;
  force?: boolean;
  cluster?: string;
}

interface InitOptions {
  name: string;
  type: 'source' | 'image';
  source?: string;
  image?: string;
  port: number;
  exposed: boolean;
  cluster?: string;
}

function generateEnvFile(options: InitOptions): string {
  const lines = [`  - name: ${options.name}`, `    port: ${options.port}`];

  if (options.type === 'source') {
    lines.push(`    source: ${options.source ?? './'}`);
  } else {
    lines.push(`    image: ${options.image ?? 'nginx:latest'}`);
  }

  if (options.exposed) {
    lines.push('    exposed: true');
  }

  const clusterLine = options.cluster
    ? `  clusterName: ${options.cluster}\n`
    : '';

  return `config:
${clusterLine}  namespace: ${options.name}-env

apps:
${lines.join('\n')}
`;
}

function sanitizeName(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'myapp';
}

function assertValidPort(port: number, portVariant: string): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    error(t('env.init.badPort', {port: portVariant}));
    process.exit(1);
  }
}

export async function envInit(flags: InitFlags = {}): Promise<void> {
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const fileExists = existsSync('./kustron-env.yaml');

  if (fileExists) {
    if (flags.force) {
      warn(t('env.init.overwriting'));
    } else if (interactive) {
      const overwrite = await confirm({
        message: 'kustron-env.yaml already exists. Overwrite?',
        initialValue: false,
      });
      if (isCancel(overwrite) || !overwrite) {
        warn('Cancelled.');
        return;
      }
    } else {
      error(t('env.init.existsForceHint'));
      process.exit(1);
    }
  }

  // Once any flag is passed, or the shell is not interactive, take every
  // decision from input already in hand — agents must never be prompted.
  const flagDriven =
    !interactive ||
    flags.name !== undefined ||
    flags.image !== undefined ||
    flags.source !== undefined ||
    flags.port !== undefined;

  let name: string;
  let type: 'source' | 'image';
  let source: string | undefined;
  let image: string | undefined;
  let port: number;
  let exposed: boolean;

  if (flagDriven) {
    if (flags.image && flags.source) {
      error(t('env.init.mutuallyExclusive'));
      process.exit(1);
    }

    const rawName = flags.name ?? basename(process.cwd());
    name = sanitizeName(rawName);
    if (flags.name !== undefined && name !== rawName) {
      warn(t('env.init.nameSanitized', {name}));
    }

    if (flags.image) {
      type = 'image';
      image = flags.image;
    } else {
      type = 'source';
      source = flags.source ?? './';
    }

    port = flags.port ?? (type === 'image' ? 80 : 3000);
    assertValidPort(port, String(port));
    exposed = flags.exposed ?? false;
  } else {
    name = (await text({
      message: 'App name?',
      placeholder: 'myapp',
      validate: (value) => {
        if (!value) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(value))
          return 'Use lowercase letters, numbers, and hyphens';
      },
    })) as string;
    if (isCancel(name)) {
      warn('Cancelled.');
      return;
    }

    type = (await select<'source' | 'image'>({
      message: 'Deploy from source or use an existing image?',
      options: [
        {value: 'source', label: 'Source (build from local directory)'},
        {value: 'image', label: 'Image (use existing container image)'},
      ],
    })) as 'source' | 'image';
    if (isCancel(type)) {
      warn('Cancelled.');
      return;
    }

    if (type === 'source') {
      const sourcePath = await text({
        message: 'Source directory?',
        placeholder: './',
        initialValue: './',
      });
      if (isCancel(sourcePath)) {
        warn('Cancelled.');
        return;
      }
      source = sourcePath;
    } else {
      const imageName = await text({
        message: 'Container image?',
        placeholder: 'nginx:latest',
        initialValue: 'nginx:latest',
      });
      if (isCancel(imageName)) {
        warn('Cancelled.');
        return;
      }
      image = imageName;
    }

    const portInput = await text({
      message: 'Port?',
      placeholder: '3000',
      initialValue: type === 'source' ? '3000' : '80',
      validate: (value) => {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Invalid port';
      },
    });
    if (isCancel(portInput)) {
      warn('Cancelled.');
      return;
    }
    port = Number(portInput);

    exposed = (await confirm({
      message: 'Expose the app (NodePort)?',
      initialValue: true,
    })) as boolean;
    if (isCancel(exposed)) {
      warn('Cancelled.');
      return;
    }
  }

  const yaml = generateEnvFile({
    name,
    type,
    source,
    image,
    port,
    exposed,
    cluster: flags.cluster ? sanitizeName(flags.cluster) : undefined,
  });
  await writeFile('./kustron-env.yaml', yaml, 'utf-8');
  success(`Created kustron-env.yaml for app '${name}'`);
  info(t('env.init.nextHint'));
}
