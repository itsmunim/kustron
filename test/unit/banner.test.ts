import {describe, it, expect, vi} from 'vitest';
import {printBanner} from '../../src/utils/banner.js';

describe('banner', () => {
  it('prints the banner to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printBanner();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
