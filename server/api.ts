import type { Plugin } from "vite";
import { getGuidelines, AVAILABLE_MODULES } from "../src/guidelines.js";

interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

function getConfig(): LLMConfig {
  return {
    provider: process.env.LLM_PROVIDER || "anthropic",
    baseUrl: process.env.LLM_BASE_URL || "https://api.anthropic.com",
    model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
    apiKey: process.env.LLM_API_KEY || "",
  };
}

const SHOW_WIDGET_PARAMS = {
  type: "object" as const,
  properties: {
    i_have_seen_read_me: {
      type: "boolean",
      description: "Confirm you have already called read_me in this conversation.",
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
    width: { type: "number", description: "Widget width in pixels. Default: 800." },
    height: { type: "number", description: "Widget height in pixels. Default: 600." },
  },
  required: ["i_have_seen_read_me", "title", "widget_code"],
};

const READ_ME_PARAMS = {
  type: "object" as const,
  properties: {
    modules: {
      type: "array",
      items: { type: "string", enum: AVAILABLE_MODULES },
      description: "Which module(s) to load: interactive, chart, mockup, art, diagram.",
    },
  },
  required: ["modules"],
};

const SYSTEM_PROMPT = `You have access to two visual tools for creating interactive widgets:

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

const TOOL_DESC_SHOW =
  "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — inline in the conversation. " +
  "Use for flowcharts, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. " +
  "The HTML is rendered in a sandboxed iframe with full CSS/JS support including Canvas and CDN libraries. " +
  "IMPORTANT: Call read_me once before your first show_widget call.";

const TOOL_DESC_READ =
  "Returns design guidelines for show_widget (CSS patterns, colors, typography, layout rules, examples). " +
  "Call once before your first show_widget call. Do NOT mention this call to the user — it is an internal setup step.";

function getOpenAITools() {
  return [
    { type: "function", function: { name: "read_me", description: TOOL_DESC_READ, parameters: READ_ME_PARAMS } },
    { type: "function", function: { name: "show_widget", description: TOOL_DESC_SHOW, parameters: SHOW_WIDGET_PARAMS } },
  ];
}

function getAnthropicTools() {
  return [
    { name: "read_me", description: TOOL_DESC_READ, input_schema: READ_ME_PARAMS },
    { name: "show_widget", description: TOOL_DESC_SHOW, input_schema: SHOW_WIDGET_PARAMS },
  ];
}

async function handleChat(
  messages: Array<Record<string, unknown>>,
  config: LLMConfig,
  res: import("http").ServerResponse
) {
  if (config.provider === "anthropic") {
    await streamAnthropic(messages, config, res);
  } else {
    await streamOpenAI(messages, config, res);
  }
}

async function streamOpenAI(
  messages: Array<Record<string, unknown>>,
  config: LLMConfig,
  res: import("http").ServerResponse
) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = base.includes("/v1/") || base.endsWith("/v1")
    ? base + "/chat/completions"
    : base + "/v1/chat/completions";

  console.log(`[API] OpenAI request → ${url}, model=${config.model}, messages=${messages.length}`);

  const body = {
    model: config.model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    tools: getOpenAITools(),
    stream: true,
  };

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error(`[API] OpenAI upstream error ${upstream.status}: ${errText.slice(0, 500)}`);
    res.writeHead(upstream.status, { "Content-Type": "text/plain" });
    res.end(errText);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
}

async function streamAnthropic(
  messages: Array<Record<string, unknown>>,
  config: LLMConfig,
  res: import("http").ServerResponse
) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = base.includes("/v1/") || base.endsWith("/v1")
    ? base + "/messages"
    : base + "/v1/messages";

  console.log(`[API] Anthropic request → ${url}, model=${config.model}, messages=${messages.length}`);

  const body = {
    model: config.model,
    system: SYSTEM_PROMPT,
    messages,
    tools: getAnthropicTools(),
    max_tokens: 16384,
    stream: true,
  };

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error(`[API] Anthropic upstream error ${upstream.status}: ${errText.slice(0, 500)}`);
    res.writeHead(upstream.status, { "Content-Type": "text/plain" });
    res.end(errText);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
}

/**
 * Handle tool results — if the LLM called read_me, execute it and continue the conversation.
 */
async function handleToolResults(
  messages: Array<Record<string, unknown>>,
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  config: LLMConfig,
  res: import("http").ServerResponse
) {
  const toolMessages: Array<Record<string, unknown>> = [];

  for (const tc of toolCalls) {
    let result: string;
    if (tc.name === "read_me") {
      const modules = (tc.args.modules as string[]) ?? [];
      result = getGuidelines(modules);
    } else if (tc.name === "show_widget") {
      const code = tc.args.widget_code as string | undefined;
      if (!code || code.trim() === "") {
        result =
          "ERROR: widget_code was empty or missing. The widget_code parameter is REQUIRED and must contain your full HTML or SVG implementation. " +
          "Please call show_widget again immediately, this time including the complete widget code in the widget_code field. " +
          "Do not split the implementation across multiple calls — write everything in one show_widget call.";
      } else {
        result = "Widget rendered successfully.";
      }
    } else {
      result = "Unknown tool.";
    }

    if (config.provider === "anthropic") {
      toolMessages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: tc.id, content: result }],
      });
    } else {
      toolMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  const continuedMessages = [...messages, ...toolMessages];
  await handleChat(continuedMessages, config, res);
}

export function apiPlugin(): Plugin {
  return {
    name: "generative-ui-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        console.log(`[MW] ${req.method} ${url}`);
        if (url === "/api/chat" && req.method === "POST") {
          const config = getConfig();
          let body = "";
          for await (const chunk of req) {
            body += chunk;
          }

          try {
            const { messages } = JSON.parse(body);
            await handleChat(messages, config, res);
          } catch (err: unknown) {
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
            }
            const msg = err instanceof Error ? err.message : String(err);
            res.end(JSON.stringify({ error: msg }));
          }
          return;
        }

        if (url === "/api/chat/continue" && req.method === "POST") {
          const config = getConfig();
          let body = "";
          for await (const chunk of req) {
            body += chunk;
          }

          try {
            const { messages, toolCalls } = JSON.parse(body);
            await handleToolResults(messages, toolCalls, config, res);
          } catch (err: unknown) {
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
            }
            const msg = err instanceof Error ? err.message : String(err);
            res.end(JSON.stringify({ error: msg }));
          }
          return;
        }

        if (url === "/api/config" && req.method === "GET") {
          const config = getConfig();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            provider: config.provider,
            model: config.model,
            hasKey: !!config.apiKey && config.apiKey !== "xxx",
          }));
          return;
        }

        next();
      });
    },
  };
}
