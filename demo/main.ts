import {
  createRenderer,
  createStreamingHandler,
  createOpenAIAdapter,
  createAnthropicAdapter,
} from "../src/index.js";
import type { StreamEvent } from "../src/index.js";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked for safe, synchronous rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  async: false,
});

const messagesEl = document.getElementById("messages")!;
const chatArea = document.getElementById("chat-area")!;
const welcome = document.getElementById("welcome")!;
const userInput = document.getElementById("user-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const themeToggle = document.getElementById("theme-toggle") as HTMLInputElement;
const configInfo = document.getElementById("config-info")!;

let currentTheme: "light" | "dark" = "light";
let conversationHistory: Array<Record<string, unknown>> = [];
let isProcessing = false;
let serverProvider = "anthropic";
const activeRenderers: ReturnType<typeof createRenderer>[] = [];

themeToggle.addEventListener("change", () => {
  currentTheme = themeToggle.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  // Update all existing widgets to match the new theme
  for (const renderer of activeRenderers) {
    renderer.setTheme(currentTheme);
  }
});

if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  currentTheme = "dark";
  themeToggle.checked = true;
  document.documentElement.setAttribute("data-theme", "dark");
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const config = await res.json();
    serverProvider = config.provider;
    configInfo.textContent = `${config.provider} / ${config.model}`;
  } catch {
    configInfo.textContent = "Server not connected";
  }
}
loadConfig();

document.querySelectorAll(".example-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = (btn as HTMLElement).dataset.prompt;
    if (prompt) {
      userInput.value = prompt;
      sendMessage();
    }
  });
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

sendBtn.addEventListener("click", sendMessage);

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addUserMessage(text: string) {
  welcome.style.display = "none";
  const div = document.createElement("div");
  div.className = "message message-user";
  div.innerHTML = `<div class="message-content">${escapeHTML(text)}</div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function createAssistantMessage(): {
  el: HTMLElement;
  textEl: HTMLElement;
  widgetContainer: HTMLElement;
} {
  const div = document.createElement("div");
  div.className = "message message-assistant";

  const content = document.createElement("div");
  content.className = "message-content";

  const textEl = document.createElement("div");
  textEl.className = "text-content";

  const widgetContainer = document.createElement("div");
  widgetContainer.className = "widget-container";

  content.appendChild(textEl);
  content.appendChild(widgetContainer);
  div.appendChild(content);
  messagesEl.appendChild(div);
  scrollToBottom();

  return { el: div, textEl, widgetContainer };
}

function addLoadingIndicator(): HTMLElement {
  const div = document.createElement("div");
  div.className = "loading-indicator";
  div.innerHTML = `
    <span class="loading-dot"></span>
    <span class="loading-dot"></span>
    <span class="loading-dot"></span>
    <span>Thinking...</span>
  `;
  messagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

function showError(text: string) {
  const div = document.createElement("div");
  div.className = "error-message";
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function escapeHTML(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/** Render markdown text to sanitized HTML and apply to an element */
function renderMarkdown(el: HTMLElement, text: string) {
  if (!text.trim()) {
    el.innerHTML = "";
    return;
  }
  const raw = marked.parse(text) as string;
  el.innerHTML = DOMPurify.sanitize(raw);
}

/**
 * Create a debounced markdown renderer for streaming use.
 * During streaming, raw text updates come very fast — we don't want to
 * re-parse markdown on every single token. Instead we debounce to ~80ms
 * and show a simple text cursor while waiting.
 */
function createStreamingMarkdownRenderer(el: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastText = "";

  return {
    update(text: string) {
      lastText = text;
      // Show raw text immediately for responsiveness, with a blinking cursor
      el.textContent = text;
      // Debounce the full markdown render
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        renderMarkdown(el, lastText);
      }, 80);
    },
    /** Force a final render (call when streaming completes) */
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      renderMarkdown(el, lastText);
    },
  };
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isProcessing) return;

  isProcessing = true;
  sendBtn.disabled = true;
  userInput.value = "";
  userInput.style.height = "auto";

  addUserMessage(text);
  const loading = addLoadingIndicator();

  conversationHistory.push({ role: "user", content: text });

  try {
    await streamFromServer(loading);
  } catch (err: unknown) {
    loading.remove();
    const msg = err instanceof Error ? err.message : String(err);
    showError(`Error: ${msg}`);
  }

  isProcessing = false;
  sendBtn.disabled = false;
}

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Process one streaming response, returning any tool calls made by the model.
 */
async function processStream(
  response: Response,
  textEl: HTMLElement,
  streamingHandler: ReturnType<typeof createStreamingHandler>,
  isAnthropic: boolean
): Promise<{ assistantText: string; toolCalls: ToolCallInfo[] }> {
  const adapter = isAnthropic
    ? createAnthropicAdapter()
    : createOpenAIAdapter();
  const mdRenderer = createStreamingMarkdownRenderer(textEl);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  const toolCalls: ToolCallInfo[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]" || !data) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (isAnthropic) {
        if (
          parsed.type === "content_block_delta" &&
          (parsed.delta as Record<string, unknown>)?.type === "text_delta"
        ) {
          assistantText +=
            (parsed.delta as Record<string, unknown>).text as string;
          mdRenderer.update(assistantText);
          scrollToBottom();
        }

        const events: StreamEvent[] = (
          adapter as ReturnType<typeof createAnthropicAdapter>
        ).processEvent(parsed);
        for (const ev of events) {
          streamingHandler.processEvent(ev);
          if (ev.type === "tool_call_end" && ev.args) {
            toolCalls.push({
              id: ev.toolCallId,
              name: ev.toolName,
              args: ev.args,
            });
          }
        }
      } else {
        const choices = parsed.choices as
          | Array<Record<string, unknown>>
          | undefined;
        if (choices?.length) {
          const delta = choices[0].delta as
            | Record<string, unknown>
            | undefined;
          if (delta?.content) {
            assistantText += delta.content as string;
            mdRenderer.update(assistantText);
            scrollToBottom();
          }
        }

        const events: StreamEvent[] = (
          adapter as ReturnType<typeof createOpenAIAdapter>
        ).processChunk(parsed);
        for (const ev of events) {
          streamingHandler.processEvent(ev);
          if (ev.type === "tool_call_end" && ev.args) {
            toolCalls.push({
              id: ev.toolCallId,
              name: ev.toolName,
              args: ev.args,
            });
          }
        }
      }
    }
  }

  // Final markdown render with full text
  mdRenderer.flush();

  return { assistantText, toolCalls };
}

function pushAssistantTurn(
  text: string,
  toolCalls: ToolCallInfo[],
  isAnthropic: boolean
) {
  if (isAnthropic) {
    const blocks: unknown[] = [];
    if (text) blocks.push({ type: "text", text });
    for (const tc of toolCalls) {
      blocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.args,
      });
    }
    if (blocks.length) {
      conversationHistory.push({ role: "assistant", content: blocks });
    }
  } else {
    if (toolCalls.length > 0) {
      conversationHistory.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        })),
      });
    } else if (text) {
      conversationHistory.push({ role: "assistant", content: text });
    }
  }
}

const MAX_TOOL_ROUNDS = 5;

async function streamFromServer(loading: HTMLElement) {
  const isAnthropic = serverProvider === "anthropic";

  const firstRes = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: conversationHistory }),
  });

  if (!firstRes.ok) {
    const errText = await firstRes.text();
    throw new Error(`Server error ${firstRes.status}: ${errText}`);
  }

  loading.remove();
  const { textEl, widgetContainer } = createAssistantMessage();

  const renderer = createRenderer({
    container: widgetContainer,
    theme: currentTheme,
    onPrompt: (promptText) => {
      userInput.value = promptText;
      sendMessage();
    },
  });
  activeRenderers.push(renderer);

  const streamingHandler = createStreamingHandler({
    renderer,
    onWidgetCreated: () => scrollToBottom(),
    onWidgetComplete: () => scrollToBottom(),
  });

  const { assistantText, toolCalls } = await processStream(
    firstRes,
    textEl,
    streamingHandler,
    isAnthropic
  );

  pushAssistantTurn(assistantText, toolCalls, isAnthropic);

  if (toolCalls.length === 0) return;

  // Loop: keep sending tool results until the model stops calling tools
  let currentToolCalls = toolCalls;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const continueLoading = addLoadingIndicator();

    try {
      const continueRes = await fetch("/api/chat/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          toolCalls: currentToolCalls,
        }),
      });

      if (!continueRes.ok) {
        const errText = await continueRes.text();
        throw new Error(`Server error ${continueRes.status}: ${errText}`);
      }

      continueLoading.remove();
      const { textEl: textEl2, widgetContainer: wc2 } =
        createAssistantMessage();

      const renderer2 = createRenderer({
        container: wc2,
        theme: currentTheme,
        onPrompt: (promptText) => {
          userInput.value = promptText;
          sendMessage();
        },
      });
      activeRenderers.push(renderer2);

      const streamingHandler2 = createStreamingHandler({
        renderer: renderer2,
        onWidgetCreated: () => scrollToBottom(),
        onWidgetComplete: () => scrollToBottom(),
      });

      const result = await processStream(
        continueRes,
        textEl2,
        streamingHandler2,
        isAnthropic
      );

      pushAssistantTurn(result.assistantText, result.toolCalls, isAnthropic);

      if (result.toolCalls.length === 0) break;
      currentToolCalls = result.toolCalls;
    } catch (err: unknown) {
      continueLoading.remove();
      const msg = err instanceof Error ? err.message : String(err);
      showError(`Error: ${msg}`);
      break;
    }
  }
}
