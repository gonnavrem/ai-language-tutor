/**
 * Zod emits a JSON Schema with a `$schema` dialect key, and Google's
 * responseSchema accepts only a subset of OpenAPI 3.0 (no
 * `additionalProperties`). Strip per provider rather than hand-writing every
 * schema twice. Recursive because Zod puts `additionalProperties` on every
 * nested object, not just the root.
 */
function omitKeysDeep(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitKeysDeep(item, keys))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !keys.includes(key))
        .map(([key, nested]) => [key, omitKeysDeep(nested, keys)]),
    )
  }
  return value
}

/** For Anthropic and OpenAI-compatible: drop only the dialect marker. */
export function withoutSchemaDialect(schema: unknown): unknown {
  return omitKeysDeep(schema, ['$schema'])
}

/** For Google: also drop `additionalProperties`, which responseSchema rejects. */
export function toGoogleSchema(schema: unknown): unknown {
  return omitKeysDeep(schema, ['$schema', 'additionalProperties'])
}
