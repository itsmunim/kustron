import {describe, it, expect} from 'vitest';
import {parseImageRef, getImageTag, getImageRepository} from '../../src/utils/image.js';

describe('parseImageRef', () => {
  it('parses simple name without tag', () => {
    expect(parseImageRef('nginx')).toEqual({
      repository: 'nginx',
      tag: undefined,
      digest: undefined,
    });
  });

  it('parses name with tag', () => {
    expect(parseImageRef('nginx:latest')).toEqual({
      repository: 'nginx',
      tag: 'latest',
      digest: undefined,
    });
  });

  it('parses registry port without tag', () => {
    expect(parseImageRef('localhost:5000/myapp')).toEqual({
      repository: 'localhost:5000/myapp',
      tag: undefined,
      digest: undefined,
    });
  });

  it('parses registry port with tag', () => {
    expect(parseImageRef('localhost:5000/myapp:v1')).toEqual({
      repository: 'localhost:5000/myapp',
      tag: 'v1',
      digest: undefined,
    });
  });

  it('parses digest reference', () => {
    expect(parseImageRef('nginx@sha256:abc123')).toEqual({
      repository: 'nginx',
      tag: undefined,
      digest: 'sha256:abc123',
    });
  });

  it('parses tag and digest together', () => {
    expect(parseImageRef('nginx:latest@sha256:abc123')).toEqual({
      repository: 'nginx',
      tag: 'latest',
      digest: 'sha256:abc123',
    });
  });

  it('parses multi-segment repository', () => {
    expect(parseImageRef('registry.io/org/app:v2')).toEqual({
      repository: 'registry.io/org/app',
      tag: 'v2',
      digest: undefined,
    });
  });
});

describe('getImageTag', () => {
  it('returns tag when present', () => {
    expect(getImageTag('nginx:latest')).toBe('latest');
  });

  it('returns "latest" when no tag', () => {
    expect(getImageTag('nginx')).toBe('latest');
  });
});

describe('getImageRepository', () => {
  it('returns repository without tag', () => {
    expect(getImageRepository('nginx:latest')).toBe('nginx');
  });

  it('returns full repository for registry port', () => {
    expect(getImageRepository('localhost:5000/app:v1')).toBe('localhost:5000/app');
  });
});
