import {describe, it, expect} from 'vitest';
import {
  isPlainObject,
  deepMerge,
  setPath,
  getPath,
} from '../../src/utils/merge.js';

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({a: 1})).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject(true)).toBe(false);
  });
});

describe('deepMerge', () => {
  it('merges top-level keys', () => {
    const result = deepMerge({a: 1}, {b: 2});
    expect(result).toEqual({a: 1, b: 2});
  });

  it('overrides scalars', () => {
    const result = deepMerge({a: 1}, {a: 2});
    expect(result).toEqual({a: 2});
  });

  it('recursively merges nested objects', () => {
    const result = deepMerge({a: {x: 1, y: 2}}, {a: {y: 3, z: 4}});
    expect(result).toEqual({a: {x: 1, y: 3, z: 4}});
  });

  it('replaces arrays (does not merge them)', () => {
    const result = deepMerge({a: [1, 2]}, {a: [3]});
    expect(result).toEqual({a: [3]});
  });

  it('does not mutate the base object', () => {
    const base = {a: {x: 1}};
    deepMerge(base, {a: {y: 2}});
    expect(base).toEqual({a: {x: 1}});
  });
});

describe('setPath', () => {
  it('sets a top-level key', () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, 'name', 'value');
    expect(obj).toEqual({name: 'value'});
  });

  it('sets a nested key', () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, 'image.tag', 'v1');
    expect(obj).toEqual({image: {tag: 'v1'}});
  });

  it('overwrites non-object intermediates', () => {
    const obj: Record<string, unknown> = {image: 'old'};
    setPath(obj, 'image.tag', 'v1');
    expect(obj).toEqual({image: {tag: 'v1'}});
  });
});

describe('getPath', () => {
  it('reads a top-level key', () => {
    expect(getPath({name: 'value'}, 'name')).toBe('value');
  });

  it('reads a nested key', () => {
    expect(getPath({image: {tag: 'v1'}}, 'image.tag')).toBe('v1');
  });

  it('returns undefined for missing keys', () => {
    expect(getPath({}, 'missing')).toBeUndefined();
    expect(getPath({a: {}}, 'a.b')).toBeUndefined();
  });

  it('returns undefined for non-object paths', () => {
    expect(getPath({a: 'string'}, 'a.b')).toBeUndefined();
  });
});
