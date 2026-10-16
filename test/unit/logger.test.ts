import {describe, it, expect, vi} from 'vitest';
import {info, success, warn, error, step} from '../../src/utils/logger.js';

describe('logger', () => {
  it('info writes via console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('success writes via console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    success('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warn writes via console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('error writes via console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('step writes via console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    step('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
