import {access} from 'fs/promises';
import {execa} from 'execa';

let cachedRuntime: string | null = null;

export async function detectContainerRuntime(): Promise<string> {
  if (cachedRuntime) return cachedRuntime;

  // Pick the daemon that is actually reachable, preferring Docker: k3d shells
  // out to the Docker CLI, so runtime and cluster must point at the same
  // daemon. Choosing by binary presence alone is non-deterministic when both
  // runtimes exist (e.g. podman machine + OrbStack) — the clusters may live in
  // either one.
  try {
    const dockerResult = await execa('docker', ['info'], {reject: false});
    if (dockerResult.exitCode === 0) {
      cachedRuntime = 'docker';
      return cachedRuntime;
    }
  } catch {
    // docker binary missing — try podman
  }

  try {
    const podmanResult = await execa('podman', ['info'], {reject: false});
    if (podmanResult.exitCode === 0) {
      cachedRuntime = 'podman';
      return cachedRuntime;
    }
  } catch {
    // podman binary missing
  }

  // Neither daemon responds. Default to docker so the error path reports the
  // daemon problem instead of silently picking an unusable runtime.
  cachedRuntime = 'docker';
  return cachedRuntime;
}

export function getContainerRuntime(): string {
  if (!cachedRuntime) {
    throw new Error('Container runtime not detected. Call detectContainerRuntime() first.');
  }
  return cachedRuntime;
}

export async function checkContainerRuntimeRunning(): Promise<boolean> {
  const runtime = await detectContainerRuntime();
  const result = await execa(runtime, ['info'], {reject: false});
  return result.exitCode === 0;
}

export async function getContainerRuntimeSocket(): Promise<string | null> {
  const runtime = await detectContainerRuntime();

  if (runtime === 'podman') {
    // macOS: podman machine socket
    try {
      const {stdout} = await execa(
        'podman',
        ['machine', 'inspect', '--format', '{{.ConnectionInfo.PodmanSocket.Path}}'],
        {reject: false},
      );
      const path = stdout.trim();
      if (path) {
        try {
          await access(path);
          return `unix://${path}`;
        } catch {
          // socket path returned but file doesn't exist (machine not running)
        }
      }
    } catch {
      // fall through
    }

    // Linux: standard podman socket
    const xdgRuntime = process.env.XDG_RUNTIME_DIR;
    if (xdgRuntime) {
      const linuxSocket = `${xdgRuntime}/podman/podman.sock`;
      try {
        await access(linuxSocket);
        return `unix://${linuxSocket}`;
      } catch {
        // fall through
      }
    }

    return null;
  }

  // Docker: check if DOCKER_HOST points to a valid socket
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost && dockerHost.startsWith('unix://')) {
    const socketPath = dockerHost.replace('unix://', '');
    try {
      await access(socketPath);
      return dockerHost;
    } catch {
      // Socket doesn't exist, fall through to check default
    }
  }

  // Check default docker socket locations
  const defaultSockets = [
    '/var/run/docker.sock',
    '/run/docker.sock',
  ];
  for (const socket of defaultSockets) {
    try {
      await access(socket);
      return `unix://${socket}`;
    } catch {
      // try next
    }
  }

  return null;
}

export async function getDockerHostEnv(): Promise<Record<string, string>> {
  const runtime = await detectContainerRuntime();

  if (runtime === 'podman') {
    const socket = await getContainerRuntimeSocket();
    if (socket) {
      return {DOCKER_HOST: socket};
    }
    return {};
  }

  // For docker, if DOCKER_HOST is set but socket doesn't exist, clear it
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost && dockerHost.startsWith('unix://')) {
    const socketPath = dockerHost.replace('unix://', '');
    try {
      await access(socketPath);
      return {DOCKER_HOST: dockerHost};
    } catch {
      // Socket doesn't exist, don't pass DOCKER_HOST
      return {};
    }
  }

  return {};
}

export async function getRuntimeCommand(): Promise<string> {
  const runtime = await detectContainerRuntime();
  return runtime === 'podman' ? 'podman' : 'docker';
}
