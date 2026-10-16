import {describe, it, expect} from 'vitest';
import {
  sanitizeCommand,
  setVerbose,
  isVerbose,
  KustronExecError,
} from '../../src/utils/exec.js';

describe('sanitizeCommand', () => {
  it('strips --password value', () => {
    expect(sanitizeCommand('cmd --password secret123')).toBe(
      'cmd --password ***',
    );
  });

  it('strips --docker-password value', () => {
    expect(sanitizeCommand('cmd --docker-password mypass')).toBe(
      'cmd --docker-password ***',
    );
  });

  it('strips --token value', () => {
    expect(sanitizeCommand('cmd --token abc123')).toBe('cmd --token ***');
  });

  it('strips -p password value', () => {
    expect(sanitizeCommand('cmd -p secret')).toBe('cmd -p ***');
  });

  it('leaves non-sensitive flags intact', () => {
    expect(sanitizeCommand('cmd --username admin --server localhost')).toBe(
      'cmd --username admin --server localhost',
    );
  });

  it('sanitizes multiple secrets in one command', () => {
    expect(
      sanitizeCommand('cmd --password p1 --token t1 --docker-password p2'),
    ).toBe('cmd --password *** --token *** --docker-password ***');
  });
});

describe('verbose mode', () => {
  it('is off by default', () => {
    expect(isVerbose()).toBe(false);
  });

  it('can be enabled', () => {
    setVerbose(true);
    expect(isVerbose()).toBe(true);
    setVerbose(false);
    expect(isVerbose()).toBe(false);
  });
});

describe('KustronExecError', () => {
  it('stores command and exitCode', () => {
    const err = new KustronExecError('fail', 'cmd arg', 1);
    expect(err.message).toBe('fail');
    expect(err.command).toBe('cmd arg');
    expect(err.exitCode).toBe(1);
    expect(err.name).toBe('KustronExecError');
  });
});
