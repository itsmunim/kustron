import {writeFile} from 'fs/promises';
import {existsSync} from 'fs';
import {text, select, confirm, isCancel} from '@clack/prompts';
import {success, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

interface InitOptions {
  name: string;
  type: 'source' | 'image';
  source?: string;
  image?: string;
  port: number;
  exposed: boolean;
}

function generateEnvFile(options: InitOptions): string {
  const app: Record<string, unknown> = {
    name: options.name,
    port: options.port,
  };

  if (options.type === 'source') {
    app.source = options.source ?? './';
  } else {
    app.image = options.image ?? 'nginx:latest';
  }

  if (options.exposed) {
    app.exposed = true;
  }

  return `config:
  namespace: ${options.name}-env

apps:
  - ${JSON.stringify(app).slice(1, -1).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, '\n    ')}
`;
}

export async function envInit(): Promise<void> {
  if (existsSync('./kustron-env.yaml')) {
    const overwrite = await confirm({
      message: 'kustron-env.yaml already exists. Overwrite?',
      initialValue: false,
    });
    if (isCancel(overwrite) || !overwrite) {
      warn('Cancelled.');
      return;
    }
  }

  const name = await text({
    message: 'App name?',
    placeholder: 'myapp',
    validate: (value) => {
      if (!value) return 'Name is required';
      if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens';
    },
  });
  if (isCancel(name)) {
    warn('Cancelled.');
    return;
  }

  const type = await select<['source', 'image']>({
    message: 'Deploy from source or use an existing image?',
    options: [
      {value: 'source', label: 'Source (build from local directory)'},
      {value: 'image', label: 'Image (use existing container image)'},
    ],
  });
  if (isCancel(type)) {
    warn('Cancelled.');
    return;
  }

  let source: string | undefined;
  let image: string | undefined;

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
  const port = Number(portInput);

  const exposed = await confirm({
    message: 'Expose the app (NodePort)?',
    initialValue: true,
  });
  if (isCancel(exposed)) {
    warn('Cancelled.');
    return;
  }

  const yaml = generateEnvFile({
    name: name as string,
    type,
    source,
    image,
    port,
    exposed: exposed as boolean,
  });

  await writeFile('./kustron-env.yaml', yaml, 'utf-8');
  success(`Created kustron-env.yaml for app '${name}'`);
}
