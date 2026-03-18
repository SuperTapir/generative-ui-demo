import type { StreamEvent, ShowWidgetParams } from "../types.js";

/**
 * Partial JSON parser — handles incomplete JSON strings from streaming.
 * Tries JSON.parse first; on failure, attempts to close open braces/brackets.
 */
function tryParsePartialJSON(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    // noop
  }

  let patched = raw.trim();
  if (!patched.startsWith("{")) return null;

  let inStr = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;

  for (const ch of patched) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  if (inStr) patched += '"';
  while (brackets > 0) {
    patched += "]";
    brackets--;
  }
  while (braces > 0) {
    patched += "}";
    braces--;
  }

  try {
    return JSON.parse(patched);
  } catch {
    return null;
  }
}

/**
 * Adapter for OpenAI-compatible streaming responses.
 * Works with openai SDK's stream or any OpenAI-format SSE chunks.
 *
 * Usage:
 * ```ts
 * const adapter = createOpenAIAdapter();
 * for await (const chunk of stream) {
 *   const events = adapter.processChunk(chunk);
 *   for (const event of events) {
 *     streamingHandler.processEvent(event);
 *   }
 * }
 * ```
 */
export function createOpenAIAdapter() {
  const activeToolCalls = new Map<
    number,
    { id: string; name: string; argBuffer: string }
  >();

  return {
    /**
     * Process an OpenAI streaming chunk and return normalized StreamEvents.
     */
    processChunk(chunk: unknown): StreamEvent[] {
      const events: StreamEvent[] = [];
      const c = chunk as Record<string, unknown>;
      const choices = c.choices as Array<Record<string, unknown>> | undefined;
      if (!choices?.length) return events;

      const delta = choices[0].delta as Record<string, unknown> | undefined;
      if (!delta) return events;

      const toolCalls = delta.tool_calls as
        | Array<Record<string, unknown>>
        | undefined;
      if (!toolCalls) return events;

      for (const tc of toolCalls) {
        const index = tc.index as number;
        const fn = tc.function as Record<string, unknown> | undefined;

        if (tc.id && fn?.name) {
          const toolCallId = tc.id as string;
          const name = fn.name as string;
          activeToolCalls.set(index, {
            id: toolCallId,
            name,
            argBuffer: "",
          });
          events.push({
            type: "tool_call_start",
            toolName: name,
            toolCallId,
          });
        }

        const argDelta = fn?.arguments as string | undefined;
        if (argDelta) {
          const active = activeToolCalls.get(index);
          if (active) {
            active.argBuffer += argDelta;
            const parsed = tryParsePartialJSON(active.argBuffer);
            events.push({
              type: "tool_call_delta",
              toolName: active.name,
              toolCallId: active.id,
              delta: argDelta,
              partialArgs: parsed as Partial<ShowWidgetParams> | undefined,
            });
          }
        }
      }

      const finishReason = choices[0].finish_reason;
      if (finishReason === "tool_calls" || finishReason === "stop") {
        for (const [index, active] of activeToolCalls) {
          const parsed = tryParsePartialJSON(active.argBuffer);
          events.push({
            type: "tool_call_end",
            toolName: active.name,
            toolCallId: active.id,
            args: parsed as unknown as ShowWidgetParams | undefined,
          });
          activeToolCalls.delete(index);
        }
      }

      return events;
    },

    /**
     * Reset the adapter state (call between conversations).
     */
    reset() {
      activeToolCalls.clear();
    },
  };
}

export type OpenAIAdapter = ReturnType<typeof createOpenAIAdapter>;
