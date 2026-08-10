import { z } from 'zod'
import type { ChatMessage, GenerateStructuredParams } from './types'
import { StructuredOutputError } from './types'
import { withoutSchemaDialect } from './providers/jsonSchema'

/** An adapter's raw, provider-specific completion call. */
export type RawCompletionFn = (
  systemPrompt: string,
  messages: ChatMessage[],
) => Promise<string>

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (fenced ? fenced[1] : text).trim()
}

function buildJsonInstructions(
  schemaName: string,
  jsonSchema: unknown,
): string {
  return [
    `Respond with a single JSON object named "${schemaName}" matching this JSON Schema:`,
    JSON.stringify(jsonSchema),
    'Output ONLY the JSON object. No markdown code fences, no commentary before or after it.',
  ].join('\n\n')
}

function parseAgainst<T>(
  schema: z.ZodType<T>,
  raw: string,
): { success: true; data: T } | { success: false; error: string } {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(stripCodeFence(raw))
  } catch (err) {
    return {
      success: false,
      error: `Response was not valid JSON: ${String(err)}`,
    }
  }

  const result = schema.safeParse(parsedJson)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: z.prettifyError(result.error) }
}

/**
 * Baseline structured-output mechanism: prompt for JSON, parse, validate,
 * retry once with the error fed back on failure. Used directly by adapters
 * with no reliable native structured-output mode (openai-compatible Custom),
 * and as the implementation underneath adapters that layer native modes on
 * top for the reliability upgrade.
 */
export async function generateStructuredViaPrompt<T>(
  callRaw: RawCompletionFn,
  { systemPrompt, prompt, schema, schemaName }: GenerateStructuredParams<T>,
): Promise<T> {
  const jsonSchema = withoutSchemaDialect(z.toJSONSchema(schema))
  const fullSystemPrompt = `${systemPrompt}\n\n${buildJsonInstructions(schemaName, jsonSchema)}`
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]

  const firstRaw = await callRaw(fullSystemPrompt, messages)
  const firstAttempt = parseAgainst(schema, firstRaw)
  if (firstAttempt.success) {
    return firstAttempt.data
  }

  const retryMessages: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: firstRaw },
    {
      role: 'user',
      content: `That response was invalid: ${firstAttempt.error}\n\nResend ONLY the corrected JSON object, matching the schema.`,
    },
  ]
  const secondRaw = await callRaw(fullSystemPrompt, retryMessages)
  const secondAttempt = parseAgainst(schema, secondRaw)
  if (secondAttempt.success) {
    return secondAttempt.data
  }

  throw new StructuredOutputError(
    `Response did not match the expected schema after retry: ${secondAttempt.error}`,
    secondRaw,
  )
}
