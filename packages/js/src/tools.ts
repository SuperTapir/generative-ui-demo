import type {
  OpenAIToolSchema,
  AnthropicToolSchema,
  GenericToolSchema,
} from "./types.js";
import { getGuidelines, AVAILABLE_MODULES } from "./guidelines.js";

const SHOW_WIDGET_PARAMS = {
  type: "object" as const,
  properties: {
    i_have_seen_read_me: {
      type: "boolean",
      description:
        "Confirm you have already called read_me in this conversation.",
    },
    title: {
      type: "string",
      description: "Short snake_case identifier for this widget.",
    },
    loading_messages: {
      type: "array",
      items: { type: "string" },
      description: "1-4 short loading messages shown while widget renders.",
    },
    widget_code: {
      type: "string",
      description:
        "HTML or SVG code to render. For SVG: raw SVG starting with <svg>. " +
        "For HTML: raw content fragment, no DOCTYPE/<html>/<head>/<body>.",
    },
    width: {
      type: "number",
      description: "Widget width in pixels. Default: 800.",
    },
    height: {
      type: "number",
      description: "Widget height in pixels. Default: 600.",
    },
  },
  required: ["i_have_seen_read_me", "title", "widget_code"],
};

const READ_ME_PARAMS = {
  type: "object" as const,
  properties: {
    modules: {
      type: "array",
      items: {
        type: "string",
        enum: AVAILABLE_MODULES,
      },
      description:
        "Which module(s) to load: interactive, chart, mockup, art, diagram.",
    },
  },
  required: ["modules"],
};

const SHOW_WIDGET_DESC =
  "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — inline in the conversation. " +
  "Use for flowcharts, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. " +
  "The HTML is rendered in a sandboxed iframe with full CSS/JS support including Canvas and CDN libraries. " +
  "IMPORTANT: Call read_me once before your first show_widget call.";

const READ_ME_DESC =
  "Returns design guidelines for show_widget (CSS patterns, colors, typography, layout rules, examples). " +
  "Call once before your first show_widget call. Do NOT mention this call to the user — it is an internal setup step.";

/**
 * Get tool definitions in OpenAI function-calling format.
 */
export function getOpenAITools(): OpenAIToolSchema[] {
  return [
    {
      type: "function",
      function: {
        name: "read_me",
        description: READ_ME_DESC,
        parameters: READ_ME_PARAMS,
      },
    },
    {
      type: "function",
      function: {
        name: "show_widget",
        description: SHOW_WIDGET_DESC,
        parameters: SHOW_WIDGET_PARAMS,
      },
    },
  ];
}

/**
 * Get tool definitions in Anthropic format.
 */
export function getAnthropicTools(): AnthropicToolSchema[] {
  return [
    {
      name: "read_me",
      description: READ_ME_DESC,
      input_schema: READ_ME_PARAMS,
    },
    {
      name: "show_widget",
      description: SHOW_WIDGET_DESC,
      input_schema: SHOW_WIDGET_PARAMS,
    },
  ];
}

/**
 * Get tool definitions in a generic format.
 */
export function getGenericTools(): GenericToolSchema[] {
  return [
    {
      name: "read_me",
      description: READ_ME_DESC,
      parameters: READ_ME_PARAMS,
    },
    {
      name: "show_widget",
      description: SHOW_WIDGET_DESC,
      parameters: SHOW_WIDGET_PARAMS,
    },
  ];
}

/**
 * Execute the read_me tool — returns design guidelines for the requested modules.
 */
export function executeReadMe(modules: string[]): string {
  return getGuidelines(modules);
}

/**
 * Get the system prompt snippet that instructs the LLM how to use the tools.
 */
export function getSystemPromptSnippet(): string {
  return `You have access to two visual tools for creating interactive widgets:

1. **read_me** — Load design guidelines before creating widgets. Call silently before first show_widget use. Pick the modules that match your use case: interactive, chart, mockup, art, diagram.

2. **show_widget** — Render interactive HTML/SVG widgets inline. Supports full CSS, JS, Canvas, and CDN libraries (cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh).

Rules:
- Call read_me once before your first show_widget call to load design guidelines.
- Do NOT mention the read_me call to the user — call it silently, then proceed directly to building the widget.
- Structure HTML as fragments: no DOCTYPE/<html>/<head>/<body>. Style first, then HTML, then scripts.
- For SVG: start code with <svg> tag, it will be auto-detected.
- Use show_widget when the user asks for visual content: charts, diagrams, interactive explainers, UI mockups, art.
- Keep widgets focused. Default size is 800x600 but adjust to fit content.
- For interactive explainers: use sliders, live calculations, Chart.js charts.
- CRITICAL: widget_code MUST always contain complete, runnable HTML or SVG code. Never call show_widget with an empty or placeholder widget_code — always write the full implementation in a single call.`;
}
