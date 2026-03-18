import type { StreamEvent, ShowWidgetParams } from "../types.js";

/**
 * Partial JSON parser for Anthropic's streaming format.
 * Handles truncated JSON by closing unclosed strings, arrays, and objects.
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

  if (escape) patched = patched.slice(0, -1);
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
 * Adapter for Anthropic streaming responses.
 * Converts Anthropic SSE events into normalized StreamEvents.
 *
 * Anthropic's streaming events:
 * - content_block_start (type: "tool_use", id, name)
 * - content_block_delta (type: "input_json_delta", partial_json)
 * - content_block_stop
 */
export function createAnthropicAdapter() {
  const activeBlocks = new Map<
    number,
    { id: string; name: string; argBuffer: string }
  >();

  return {
    processEvent(event: unknown): StreamEvent[] {
      const events: StreamEvent[] = [];
      const e = event as Record<string, unknown>;
      const eventType = e.type as string;

      if (eventType === "content_block_start") {
        const index = e.index as number;
        const block = e.content_block as Record<string, unknown>;
        if (block?.type === "tool_use") {
          const id = block.id as string;
          const name = block.name as string;
          activeBlocks.set(index, { id, name, argBuffer: "" });
          events.push({
            type: "tool_call_start",
            toolName: name,
            toolCallId: id,
          });
        }
      }

      if (eventType === "content_block_delta") {
        const index = e.index as number;
        const delta = e.delta as Record<string, unknown>;
        if (delta?.type === "input_json_delta") {
          const partialJson = delta.partial_json as string;
          const active = activeBlocks.get(index);
          if (active && partialJson) {
            active.argBuffer += partialJson;
            const parsed = tryParsePartialJSON(active.argBuffer);
            events.push({
              type: "tool_call_delta",
              toolName: active.name,
              toolCallId: active.id,
              delta: partialJson,
              partialArgs: parsed as Partial<ShowWidgetParams> | undefined,
            });
          }
        }
      }

      if (eventType === "content_block_stop") {
        const index = e.index as number;
        const active = activeBlocks.get(index);
        if (active) {
          const parsed = tryParsePartialJSON(active.argBuffer);
          events.push({
            type: "tool_call_end",
            toolName: active.name,
            toolCallId: active.id,
            args: parsed as unknown as ShowWidgetParams | undefined,
          });
          activeBlocks.delete(index);
        }
      }

      return events;
    },

    reset() {
      activeBlocks.clear();
    },
  };
}

export type AnthropicAdapter = ReturnType<typeof createAnthropicAdapter>;
