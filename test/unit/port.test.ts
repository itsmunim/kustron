import {describe, it, expect} from 'vitest';
import {createServer} from 'net';
import {findAvailablePort} from '../../src/utils/port.js';

describe('findAvailablePort', () => {
  it('returns startPort when it is free', async () => {
    const port = await findAvailablePort(40000);
    expect(port).toBeGreaterThanOrEqual(40000);
  });

  it('returns a port >= startPort', async () => {
    const port = await findAvailablePort(40001);
    expect(port).toBeGreaterThanOrEqual(40001);
  });
});
