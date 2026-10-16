import {describe, it, expect} from 'vitest';
import {getContainerRuntime} from '../../src/utils/container-runtime.js';

describe('getContainerRuntime', () => {
  it('throws when runtime has not been detected', () => {
    expect(() => getContainerRuntime()).toThrow(
      'Container runtime not detected',
    );
  });
});
