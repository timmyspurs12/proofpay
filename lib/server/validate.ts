/**
 * Minimal dependency-free validator (avoids an extra runtime dependency while
 * keeping every API input explicitly checked server-side).
 */
export class ZodError extends Error {}

type Rule = (v: unknown, field: string) => void;

export const isString =
  (min = 0, max = 10000): Rule =>
  (v, f) => {
    if (typeof v !== 'string' || v.trim().length < min || v.length > max)
      throw new ZodError(`"${f}" must be a string between ${min} and ${max} characters`);
  };

export const isInt =
  (min = -Infinity, max = Infinity): Rule =>
  (v, f) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
      throw new ZodError(`"${f}" must be an integer in range`);
  };

export const isEnum =
  (values: readonly string[]): Rule =>
  (v, f) => {
    if (typeof v !== 'string' || !values.includes(v))
      throw new ZodError(`"${f}" must be one of: ${values.join(', ')}`);
  };

export const isBool: Rule = (v, f) => {
  if (typeof v !== 'boolean') throw new ZodError(`"${f}" must be a boolean`);
};

export const isArrayOfStrings: Rule = (v, f) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new ZodError(`"${f}" must be an array of strings`);
};

export function validate<T extends Record<string, unknown>>(body: unknown, schema: Record<keyof T, Rule>): T {
  if (typeof body !== 'object' || body === null) throw new ZodError('Request body must be a JSON object');
  const out: Record<string, unknown> = {};
  for (const [field, rule] of Object.entries(schema)) {
    const v = (body as Record<string, unknown>)[field];
    rule(v, field);
    out[field] = v;
  }
  return out as T;
}

export function optional<T>(body: Record<string, unknown>, field: string, rule: Rule): T | undefined {
  const v = body[field];
  if (v === undefined || v === null) return undefined;
  rule(v, field);
  return v as T;
}
