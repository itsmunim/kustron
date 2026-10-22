import {describe, it, expect, beforeEach, vi} from 'vitest';
import {mkdtemp, writeFile, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

vi.mock('../../src/core/cluster.js', () => ({
  clusterExists: vi.fn(),
  isClusterRunning: vi.fn(),
  getK3dNodeIp: vi.fn(),
  deleteCluster: vi.fn(),
  createCluster: vi.fn(),
  k3dCommandOutput: vi.fn(),
}));

vi.mock('../../src/core/kubectl.js', () => ({
  kubectl: vi.fn(),
  helm: vi.fn(),
}));

import {kubectl, helm} from '../../src/core/kubectl.js';
import {
  clusterExists,
  isClusterRunning,
  getK3dNodeIp,
} from '../../src/core/cluster.js';
import {envStatus} from '../../src/commands/env/status.js';

const mockedKubectl = vi.mocked(kubectl);
const mockedHelm = vi.mocked(helm);
const mockedClusterExists = vi.mocked(clusterExists);
const mockedIsClusterRunning = vi.mocked(isClusterRunning);
const mockedNodeIp = vi.mocked(getK3dNodeIp);

const ENV = `config:
  namespace: sntest
apps:
  - name: api
    source: ./
    port: 3000
    exposed: true
  - name: db
    image: postgres:15
    port: 5432
`;

function deploymentPayload(ready = 1, desired = 1): string {
  return JSON.stringify({
    spec: {
      replicas: desired,
      template: {spec: {containers: [{image: 'kreg/kustron/api:abc123'}]}},
    },
    status: {readyReplicas: ready},
  });
}

function kubectlHandler(runningPhase: string) {
  return async (_cluster: string, args: string[]) => {
    const [verb, resource, target] = args;
    if (verb === 'get' && resource === 'deployment') {
      return {
        exitCode: 0,
        stdout: deploymentPayload(1, 1),
      };
    }
    if (verb === 'get' && resource === 'pods') {
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          items: [{status: {phase: runningPhase, containerStatuses: []}}],
        }),
      };
    }
    if (verb === 'get' && resource === 'service') {
      return {exitCode: 0, stdout: '30777'};
    }
    return {exitCode: 1, stdout: ''};
  };
}

async function newEnvDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kustron-status-test-'));
  await writeFile(join(dir, 'kustron-env.yaml'), ENV, 'utf-8');
  return dir;
}

describe('env status --json', () => {
  let dir: string;
  let originalDir: string;
  let logged: unknown[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    originalDir = process.cwd();
    dir = await newEnvDir();
    process.chdir(dir);
    process.exitCode = 0;
    logged = [];
    logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((...args: unknown[]) => {
        logged.push(...args);
      });
    mockedKubectl.mockClear();
    mockedHelm.mockReset();
    mockedClusterExists.mockResolvedValue(true as never);
    mockedIsClusterRunning.mockResolvedValue(true as never);
    mockedNodeIp.mockResolvedValue('127.0.0.1' as never);
  });

  async function snapshot(): Promise<any> {
    return JSON.parse(logged.join('\n'));
  }

  it('prints a machine-readable snapshot and exits 0 when healthy', async () => {
    mockedKubectl.mockImplementation(kubectlHandler('Running') as never);

    await envStatus({json: true});

    const snap = await snapshot();
    expect(snap.cluster).toEqual({
      name: 'kustron',
      exists: true,
      running: true,
    });
    expect(snap.namespace).toBe('sntest');
    expect(snap.healthy).toBe(true);
    expect(snap.apps[0]).toMatchObject({
      name: 'api',
      type: 'source',
      state: 'running',
      readyReplicas: 1,
      desiredReplicas: 1,
      exposed: true,
      nodePort: 30777,
      url: 'http://127.0.0.1:30777',
      healthy: true,
    });
    // db is not exposed — no nodePort, not reachable by name from outside
    expect(snap.apps[1]).toMatchObject({
      name: 'db',
      exposed: false,
      nodePort: null,
      healthy: true,
    });
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 and reports unhealthy when an app crash-loops', async () => {
    mockedKubectl.mockImplementation(
      async (_cluster: string, args: string[]) => {
        if (args[0] === 'get' && args[1] === 'pods') {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              items: [
                {
                  status: {
                    phase: 'Running',
                    containerStatuses: [
                      {state: {waiting: {reason: 'CrashLoopBackOff'}}},
                    ],
                  },
                },
              ],
            }),
          } as never;
        }
        return kubectlHandler('CrashLoop')(_cluster, args) as never;
      },
    );

    await envStatus({json: true});

    const snap = await snapshot();
    expect(snap.healthy).toBe(false);
    expect(snap.apps.every((app: any) => app.healthy === false)).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('exits 1 when a deployed app misses replicas', async () => {
    mockedKubectl.mockImplementation(async (_c: string, args: string[]) => {
      if (args[1] === 'deployment') {
        return {
          exitCode: 0,
          stdout: deploymentPayload(0, 2),
        } as never;
      }
      return kubectlHandler('Running')(_c, args) as never;
    });

    await envStatus({json: true});

    const snap = await snapshot();
    expect(snap.healthy).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('exits 1 when the cluster is missing', async () => {
    mockedClusterExists.mockResolvedValue(false as never);
    mockedKubectl.mockImplementation(kubectlHandler('Running') as never);

    await envStatus({json: true});

    const snap = await snapshot();
    expect(snap.cluster).toEqual({
      name: 'kustron',
      exists: false,
      running: false,
    });
    expect(snap.healthy).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('gates helm apps on release status, not deployment tables', async () => {
    await writeFile(
      join(dir, 'kustron-env.yaml'),
      `${ENV}
  - name: rabbit
    helm:
      chart: ./charts/rabbit
      values:
        auth.username: guest
`,
      'utf-8',
    );
    mockedKubectl.mockImplementation(kubectlHandler('Running') as never);
    mockedHelm.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({info: {status: 'deployed'}}),
    } as never);

    await envStatus({json: true});

    const snap = await snapshot();
    const rabbit = snap.apps.find((a: any) => a.name === 'rabbit');
    expect(rabbit.state).toBe('deployed');
    expect(rabbit.healthy).toBe(true);
    expect(snap.healthy).toBe(true);

    // missing release → unhealthy
    logged.length = 0;
    process.exitCode = 0;
    mockedHelm.mockResolvedValue({exitCode: 1, stdout: ''} as never);
    await envStatus({json: true});
    const snap2 = await snapshot();
    const rabbit2 = snap2.apps.find((a: any) => a.name === 'rabbit');
    expect(rabbit2.state).toBe('missing');
    expect(rabbit2.healthy).toBe(false);
    expect(snap2.healthy).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('falls back to a localhost URL when no node IP is resolvable', async () => {
    mockedNodeIp.mockResolvedValue(null as never);
    mockedKubectl.mockImplementation(kubectlHandler('Running') as never);

    await envStatus({json: true});

    const snap = await snapshot();
    expect(snap.apps[0].url).toBe('http://localhost:30777');
    expect(snap.apps[0].healthy).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  afterEach(async () => {
    process.chdir(originalDir);
    logSpy.mockRestore();
    await rm(dir, {recursive: true});
  });
});
