import {describe, it, expect} from 'vitest';
import {appDeploymentName} from '../../src/core/deps.js';
import type {AppEntry} from '../../src/types/index.js';

describe('app commands helpers', () => {
  it('appDeploymentName includes instance suffix', () => {
    const app = {name: 'api', instance: 'v1'} as AppEntry;
    expect(appDeploymentName(app)).toBe('api-v1');
  });

  it('appDeploymentName returns plain name without instance', () => {
    const app = {name: 'api'} as AppEntry;
    expect(appDeploymentName(app)).toBe('api');
  });
});
