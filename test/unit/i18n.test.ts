import {describe, it, expect} from 'vitest';
import {t} from '../../src/utils/i18n.js';

describe('i18n', () => {
  it('returns the translation for known keys', () => {
    expect(t('env.up.noEnvFile')).toBeTruthy();
    expect(typeof t('env.up.noEnvFile')).toBe('string');
  });

  it('interpolates {{var}} syntax', () => {
    const result = t('env.up.success', {name: 'test'});
    expect(result).toContain('test');
  });

  it('leaves unknown vars as placeholders', () => {
    const result = t('env.up.success', {});
    expect(result).toContain('{{name}}');
  });

  it('throws for unknown keys under test (strict mode)', () => {
    // t() must never silently echo a missing key in tests — that is how
    // raw i18n keys were leaking into the shipped --help output.
    expect(() => t('unknown.key.that.does.not.exist')).toThrow(
      /Missing translation key/,
    );
  });
});
