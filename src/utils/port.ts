import {createServer} from 'net';
import {exec} from './exec.js';

/**
 * Probe a concrete port with an *exclusive* bind (no SO_REUSEADDR).
 *
 * Node's net server always sets SO_REUSEADDR, which makes it see binds as
 * free when a macOS service (e.g. AirPlay Receiver on port 5000) is already
 * holding the port — the later k3d/docker bind then fails with a cryptic
 * error. Probing via a separate process without SO_REUSEADDR gives the
 * same verdict the real bind will get.
 */
async function pythonExclusiveBindProbe(
  port: number,
): Promise<'free' | 'busy' | 'unavailable'> {
  try {
    const {exitCode} = await exec(
      'python3',
      [
        '-c',
        `import socket,sys
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
try:
  s.bind(('0.0.0.0',${port}))
except OSError as e:
  sys.exit(1 if e.errno in (48,98,10048) else 2)
sys.exit(0)`,
      ],
      {silent: true, reject: false},
    );
    return exitCode === 0 ? 'free' : 'busy';
  } catch {
    return 'unavailable';
  }
}

/**
 * Probe a concrete port with Node's net server (SO_REUSEADDR bind).
 * Used as a fallback when python3 is unavailable; mirrors the old behavior.
 */
function nodeBindProbe(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function isPortFree(port: number): Promise<boolean> {
  const verdict = await pythonExclusiveBindProbe(port);
  if (verdict === 'unavailable') return nodeBindProbe(port);
  return verdict === 'free';
}

/**
 * Find the next available TCP port starting from `startPort`.
 * Returns `startPort` if it's free, otherwise scans upward.
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  for (let i = 0; i < 50; i++) {
    if (await isPortFree(port)) return port;
    port++;
  }
  throw new Error(`No available TCP port found starting from ${startPort}`);
}
