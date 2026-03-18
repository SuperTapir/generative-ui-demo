import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const AVAILABLE_MODULES = ["interactive", "chart", "mockup", "art", "diagram"];

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

function getTools(provider) {
  const readParams = {
    type: "object",
    properties: { modules: { type: "array", items: { type: "string", enum: AVAILABLE_MODULES }, description: "Which module(s) to load." } },
    required: ["modules"],
  };
  const showParams = {
    type: "object",
    properties: {
      widget_code: {
        type: "string",
        description:
          "REQUIRED. The complete, self-contained HTML or SVG implementation. " +
          "For HTML: write a full fragment (no DOCTYPE/<html>/<head>/<body>) with <style>, markup, and <script> in that order. " +
          "For SVG: start with <svg>. NEVER leave this field empty — always write the full code here.",
      },
      title: { type: "string", description: "Short snake_case identifier." },
      i_have_seen_read_me: { type: "boolean", description: "Set true after calling read_me." },
      loading_messages: { type: "array", items: { type: "string" }, description: "1-3 short loading messages shown while the widget initializes." },
      width: { type: "number", description: "Width in pixels. Default: 800." },
      height: { type: "number", description: "Height in pixels. Default: 600." },
    },
    required: ["widget_code", "title", "i_have_seen_read_me"],
  };
  const readDesc = "Returns design guidelines for show_widget. Call once before first show_widget. Do NOT mention to the user.";
  const showDesc =
    "Render an interactive HTML or SVG widget inline. " +
    "You MUST provide the complete implementation in widget_code in the SAME call — never call this tool without widget_code. " +
    "Supports full CSS, JS, Canvas, and CDN libraries (cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh).";

  if (provider === "anthropic") {
    return [
      { name: "read_me", description: readDesc, input_schema: readParams },
      { name: "show_widget", description: showDesc, input_schema: showParams },
    ];
  }
  return [
    { type: "function", function: { name: "read_me", description: readDesc, parameters: readParams } },
    { type: "function", function: { name: "show_widget", description: showDesc, parameters: showParams } },
  ];
}

/** @returns {import('vite').Plugin} */
function apiPlugin() {
  /** @type {((modules: string[]) => string) | null} */
  let _getGuidelines = null;

  async function loadGuidelines() {
    if (!_getGuidelines) {
      const mod = await import("./src/guidelines.js");
      _getGuidelines = mod.getGuidelines;
    }
    return _getGuidelines;
  }

  async function handleUpstream(messages, res) {
    const provider = process.env.LLM_PROVIDER || "anthropic";
    const baseUrl = (process.env.LLM_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
    const model = process.env.LLM_MODEL || "claude-sonnet-4-6";
    const apiKey = process.env.LLM_API_KEY || "";

    let url, headers, body;

    if (provider === "anthropic") {
      url = baseUrl.endsWith("/v1") ? baseUrl + "/messages" : baseUrl + "/v1/messages";
      headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
      body = { model, system: SYSTEM_PROMPT, messages, tools: getTools("anthropic"), max_tokens: 16384, stream: true };
    } else {
      url = baseUrl.endsWith("/v1") ? baseUrl + "/chat/completions" : baseUrl + "/v1/chat/completions";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
      body = { model, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages], tools: getTools("openai"), stream: true };
    }

    console.log(`[API] → ${url} (model=${model}, msgs=${messages.length})`);

    const upstream = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`[API] Upstream ${upstream.status}: ${errText.slice(0, 300)}`);
      res.writeHead(upstream.status, { "Content-Type": "text/plain" });
      res.end(errText);
      return;
    }

    if (res.socket) res.socket.setNoDelay(true);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Encoding": "identity",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    });
    res.flushHeaders();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
        if (typeof res.flush === "function") res.flush();
      }
    } finally {
      res.end();
    }
  }

  return {
    name: "generative-ui-api",
    configureServer(server) {
      console.log("[API] Plugin loaded, registering middleware");

      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        if (url === "/api/config" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            provider: process.env.LLM_PROVIDER || "anthropic",
            model: process.env.LLM_MODEL || "claude-sonnet-4-6",
            hasKey: !!process.env.LLM_API_KEY,
          }));
          return;
        }

        if (url === "/api/chat" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { messages } = JSON.parse(body);
              await handleUpstream(messages, res);
            } catch (err) {
              if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message || String(err) }));
            }
          });
          return;
        }

        if (url === "/api/chat/continue" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const getGuidelines = await loadGuidelines();
              const { messages, toolCalls } = JSON.parse(body);
              const provider = process.env.LLM_PROVIDER || "anthropic";
              const toolMessages = [];

              for (const tc of toolCalls) {
                let result;
                if (tc.name === "read_me") {
                  result = getGuidelines(tc.args.modules || []);
                } else if (tc.name === "show_widget") {
                  const code = tc.args.widget_code;
                  if (!code || String(code).trim() === "") {
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
                if (provider === "anthropic") {
                  toolMessages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: tc.id, content: result }] });
                } else {
                  toolMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
                }
              }

              await handleUpstream([...messages, ...toolMessages], res);
            } catch (err) {
              if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message || String(err) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "LLM_");
  for (const key in env) {
    process.env[key] = env[key];
  }

  return {
    root: "demo",
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "GenerativeUI",
        fileName: "index",
        formats: ["es"],
      },
      outDir: resolve(__dirname, "dist"),
    },
    server: { port: 3000, headers: { "Cache-Control": "no-store" } },
    plugins: [apiPlugin()],
  };
});
