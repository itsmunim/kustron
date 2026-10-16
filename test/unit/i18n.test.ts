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

  it('returns the key itself for unknown keys', () => {
    expect(t('unknown.key.that.does.not.exist')).toBe(
      'unknown.key.that.does.not.exist',
    );
  });
});
