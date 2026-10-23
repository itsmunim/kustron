import {describe, it, expect, afterEach} from 'vitest';
import {createServer} from 'net';
import {probeTcp} from '../../src/utils/net-probe.js';

const servers: Array<import('net').Server> = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
});

describe('probeTcp', () => {
  it('returns true when a listener accepts the connection', async () => {
    const server = createServer((socket) => socket.end());
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );

    const port = (server.address() as {port: number}).port;
    expect(await probeTcp('127.0.0.1', port, 300)).toBe(true);
  });

  it('returns false when the connection is refused', async () => {
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as {port: number}).port;
    server.close();

    expect(await probeTcp('127.0.0.1', port, 300)).toBe(false);
  });
});
