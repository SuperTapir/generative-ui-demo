import {
  createRenderer,
  createStreamingHandler,
  createAnthropicAdapter,
} from "generative-ui";
import type { StreamEvent } from "generative-ui";
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
const activeRenderers: ReturnType<typeof createRenderer>[] = [];

// Backend API base URL — direct connection, no proxy
const API_BASE = "http://127.0.0.1:8000";

themeToggle.addEventListener("change", () => {
  currentTheme = themeToggle.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
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
    const res = await fetch(`${API_BASE}/api/config`);
    const config = await res.json();
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

/**
 * State for a single assistant message with dynamic block ordering.
 * Text and widget blocks are appended in arrival order so that
 * whichever content arrives first renders on top.
 */
interface TextBlockEntry {
  el: HTMLElement;
  mdRenderer: ReturnType<typeof createStreamingMarkdownRenderer>;
  text: string;
}

interface AssistantMessageState {
  contentEl: HTMLElement;
  currentTextEl: HTMLElement | null;
  textBlocks: TextBlockEntry[];
}

function createAssistantMessage(): AssistantMessageState {
  const div = document.createElement("div");
  div.className = "message message-assistant";

  const contentEl = document.createElement("div");
  contentEl.className = "message-content";

  div.appendChild(contentEl);
  messagesEl.appendChild(div);
  scrollToBottom();

  return { contentEl, currentTextEl: null, textBlocks: [] };
}

/**
 * Get or create the current text block. If the last child of contentEl
 * is already the active text block, reuse it. Otherwise create a new one
 * (e.g. after a widget was inserted).
 */
function ensureTextBlock(state: AssistantMessageState): TextBlockEntry {
  if (
    state.currentTextEl &&
    state.contentEl.lastElementChild === state.currentTextEl
  ) {
    return state.textBlocks[state.textBlocks.length - 1];
  }

  const textEl = document.createElement("div");
  textEl.className = "text-content";
  state.contentEl.appendChild(textEl);
  state.currentTextEl = textEl;

  const mdRenderer = createStreamingMarkdownRenderer(textEl);
  const entry: TextBlockEntry = { el: textEl, mdRenderer, text: "" };
  state.textBlocks.push(entry);
  return entry;
}

/**
 * Create a new widget container appended after the current content.
 * Invalidates the current text block so the next text delta creates
 * a new block below the widget.
 */
function ensureWidgetContainer(state: AssistantMessageState): HTMLElement {
  const container = document.createElement("div");
  container.className = "widget-container";
  state.contentEl.appendChild(container);
  state.currentTextEl = null; // next text will go below this widget
  return container;
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

function renderMarkdown(el: HTMLElement, text: string) {
  if (!text.trim()) {
    el.innerHTML = "";
    return;
  }
  const raw = marked.parse(text) as string;
  el.innerHTML = DOMPurify.sanitize(raw);
}

function createStreamingMarkdownRenderer(el: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastText = "";

  return {
    update(text: string) {
      lastText = text;
      el.textContent = text;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        renderMarkdown(el, lastText);
      }, 80);
    },
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

/**
 * Stream a response from the FastAPI backend.
 *
 * The backend handles tool loops server-side (read_me calls are executed
 * on the server and the conversation continues automatically). The frontend
 * only needs to process the streaming SSE events for rendering.
 */
async function streamFromServer(loading: HTMLElement) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: conversationHistory }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Server error ${res.status}: ${errText}`);
  }

  loading.remove();
  const state = createAssistantMessage();

  // Per-widget renderers and streaming handlers, keyed by toolCallId
  const widgetHandlers = new Map<
    string,
    {
      renderer: ReturnType<typeof createRenderer>;
      handler: ReturnType<typeof createStreamingHandler>;
    }
  >();

  const onPrompt = (promptText: string) => {
    userInput.value = promptText;
    sendMessage();
  };

  const adapter = createAnthropicAdapter();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";

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

      // Handle text deltas — append to the current (or new) text block
      if (
        parsed.type === "content_block_delta" &&
        (parsed.delta as Record<string, unknown>)?.type === "text_delta"
      ) {
        const deltaText = (parsed.delta as Record<string, unknown>)
          .text as string;
        assistantText += deltaText;

        const block = ensureTextBlock(state);
        block.text += deltaText;
        block.mdRenderer.update(block.text);
        scrollToBottom();
      }

      // Handle tool call events (show_widget rendering)
      const events: StreamEvent[] = adapter.processEvent(parsed);
      for (const ev of events) {
        if (ev.type === "tool_call_start" && ev.toolName === "show_widget") {
          // Create a new widget container at the current position
          const container = ensureWidgetContainer(state);
          const renderer = createRenderer({
            container,
            theme: currentTheme,
            onPrompt,
          });
          activeRenderers.push(renderer);
          const handler = createStreamingHandler({
            renderer,
            onWidgetCreated: () => scrollToBottom(),
            onWidgetComplete: () => scrollToBottom(),
          });
          widgetHandlers.set(ev.toolCallId, { renderer, handler });
          handler.processEvent(ev);
        } else {
          // Route delta/end events to the correct handler
          const entry = widgetHandlers.get(ev.toolCallId);
          if (entry) {
            entry.handler.processEvent(ev);
            if (ev.type === "tool_call_end") {
              widgetHandlers.delete(ev.toolCallId);
            }
          }
        }
      }
    }
  }

  // Flush all text block markdown renderers
  for (const block of state.textBlocks) {
    block.mdRenderer.flush();
  }

  // Store assistant response in history for future turns
  if (assistantText) {
    conversationHistory.push({ role: "assistant", content: assistantText });
  }
}
