import {describe, it, expect} from 'vitest';
import {z} from 'zod';

describe('env file schema validation', () => {
  const appEntrySchema = z
    .object({
      name: z.string().min(1),
      source: z.string().optional(),
      image: z.string().optional(),
      port: z.union([z.number(), z.string()]).optional(),
      exposed: z.boolean().optional(),
      replicas: z.number().optional(),
      ha: z.boolean().optional(),
      env: z.record(z.string(), z.string()).optional(),
      secret: z.record(z.string(), z.string()).optional(),
      command: z.array(z.string()).optional(),
      args: z.array(z.string()).optional(),
      patch: z.record(z.string(), z.unknown()).optional(),
      dependsOn: z.array(z.string()).optional(),
    })
    .strict()
    .refine(
      (data) => {
        const hasSource = !!data.source;
        const hasImage = !!data.image;
        const hasHelm = !!data.helm;
        if (hasSource && hasImage) return false;
        if (hasHelm && (hasSource || hasImage)) {
          return !!data.helm?.imageValues;
        }
        return [hasSource, hasImage, hasHelm].filter(Boolean).length === 1;
      },
      {message: 'Each app must have exactly one of: source, image, helm'},
    );

  it('accepts a valid source app', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      port: 3000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid image app', () => {
    const result = appEntrySchema.safeParse({
      name: 'redis',
      image: 'redis:7',
      port: 6379,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      port: 3000,
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = appEntrySchema.safeParse({
      name: '',
      source: './api',
      port: 3000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects source + image together', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      image: 'nginx',
      port: 3000,
    });
    expect(result.success).toBe(false);
  });
});
