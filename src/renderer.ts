import morphdom from "morphdom";
import type { WidgetRenderOptions, WidgetInstance } from "./types.js";
import { buildSvgStyles } from "./svg-styles.js";

let widgetCounter = 0;
const loadedScripts = new Set<string>();

const DEFAULT_LOADING_MESSAGES = [
  "Generating widget…",
  "Building layout…",
  "Rendering content…",
  "Almost there…",
];

/**
 * Registry of all active shadow roots. Used by the global document method
 * overrides so that LLM-generated scripts can find elements inside their
 * shadow DOM via `document.getElementById(...)` etc., even when called
 * later from inline event handlers (onclick, oninput, ...).
 */
const activeShadowRoots = new Set<ShadowRoot>();

/**
 * Whether we have already patched the global document query methods.
 * We only install the overrides once (on first widget activation) and
 * leave them in place for the lifetime of the page.
 */
let documentPatched = false;

/**
 * Patch global `document` query methods so they also search inside
 * registered shadow roots. The lookup order is:
 *   1. Real document (original method)
 *   2. Each registered shadow root (in insertion order)
 * First non-null result wins.
 */
function patchDocumentQueries() {
  if (documentPatched) return;
  documentPatched = true;

  // Methods that return a single element (or null)
  const singleMethods = ["getElementById", "querySelector"] as const;
  // Methods that return a collection
  const multiMethods = [
    "querySelectorAll",
    "getElementsByClassName",
    "getElementsByTagName",
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = document as any;

  for (const method of singleMethods) {
    const original = doc[method].bind(document);
    doc[method] = (arg: string) => {
      const result = original(arg);
      if (result) return result;
      for (const sr of activeShadowRoots) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = (sr as any)[method](arg);
        if (found) return found;
      }
      return null;
    };
  }

  for (const method of multiMethods) {
    const original = doc[method].bind(document);
    doc[method] = (arg: string) => {
      const result = original(arg);
      if (result.length > 0) return result;
      for (const sr of activeShadowRoots) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = (sr as any)[method](arg);
        if (found.length > 0) return found;
      }
      return result; // return original empty collection
    };
  }
}

function buildThemeCSS(theme: "light" | "dark"): string {
  const isDark = theme === "dark";

  const themeVars = isDark
    ? `
    --p: #e0e0e0; --s: #a0a0a0; --t: #707070;
    --bg2: #2a2a2a; --b: #404040;
    --color-text-primary: #e0e0e0;
    --color-text-secondary: #a0a0a0;
    --color-text-tertiary: #707070;
    --color-text-info: #85B7EB;
    --color-text-danger: #F09595;
    --color-text-success: #97C459;
    --color-text-warning: #EF9F27;
    --color-background-primary: #1a1a1a;
    --color-background-secondary: #2a2a2a;
    --color-background-tertiary: #111111;
    --color-background-info: #0C447C;
    --color-background-danger: #791F1F;
    --color-background-success: #27500A;
    --color-background-warning: #633806;
    --color-border-primary: rgba(255,255,255,0.4);
    --color-border-secondary: rgba(255,255,255,0.3);
    --color-border-tertiary: rgba(255,255,255,0.15);
    --color-border-info: #85B7EB;
    --color-border-danger: #F09595;
    --color-border-success: #97C459;
    --color-border-warning: #EF9F27;
    `
    : `
    --p: #1a1a1a; --s: #6b6b6b; --t: #999999;
    --bg2: #f5f5f5; --b: #e0e0e0;
    --color-text-primary: #1a1a1a;
    --color-text-secondary: #6b6b6b;
    --color-text-tertiary: #999999;
    --color-text-info: #185FA5;
    --color-text-danger: #A32D2D;
    --color-text-success: #3B6D11;
    --color-text-warning: #854F0B;
    --color-background-primary: #ffffff;
    --color-background-secondary: #f5f5f5;
    --color-background-tertiary: #fafafa;
    --color-background-info: #E6F1FB;
    --color-background-danger: #FCEBEB;
    --color-background-success: #EAF3DE;
    --color-background-warning: #FAEEDA;
    --color-border-primary: rgba(0,0,0,0.4);
    --color-border-secondary: rgba(0,0,0,0.3);
    --color-border-tertiary: rgba(0,0,0,0.15);
    --color-border-info: #378ADD;
    --color-border-danger: #E24B4A;
    --color-border-success: #639922;
    --color-border-warning: #BA7517;
    `;

  return `
:host {
  ${themeVars}
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-serif: Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;
  display: block;
}
.gui-root {
  margin: 0;
  padding: 1rem;
  font-family: var(--font-sans);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.7;
  box-sizing: border-box;
}
.gui-root *, .gui-root *::before, .gui-root *::after {
  box-sizing: border-box;
}
@keyframes _fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@keyframes _shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes _loadingDot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
@keyframes _messageFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes _messageFadeOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-6px); }
}
.gui-loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  gap: 16px;
  animation: _fadeIn 0.3s ease both;
}
.gui-loading-shimmer {
  width: 100%;
  max-width: 320px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--color-border-tertiary) 25%,
    var(--color-border-secondary) 50%,
    var(--color-border-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: _shimmer 1.8s ease infinite;
}
.gui-loading-dots {
  display: flex;
  gap: 6px;
}
.gui-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  animation: _loadingDot 1.2s ease infinite;
}
.gui-loading-dot:nth-child(2) { animation-delay: 0.2s; }
.gui-loading-dot:nth-child(3) { animation-delay: 0.4s; }
.gui-loading-message {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  min-height: 20px;
  animation: _messageFadeIn 0.3s ease both;
}
.gui-loading-message.fading-out {
  animation: _messageFadeOut 0.3s ease both;
}
${buildSvgStyles(theme)}
`;
}

function resolveTheme(theme: "light" | "dark" | "auto"): "light" | "dark" {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

const SCRIPT_LOAD_TIMEOUT = 10_000; // 10 seconds

/**
 * Load an external script and return a promise that resolves when it's ready.
 * Appends the script to document.head (main document) so it loads reliably
 * and its globals (e.g. Chart, d3) are available to inline scripts.
 * Deduplicates by URL — if the same script was already loaded, resolves immediately.
 * Times out after SCRIPT_LOAD_TIMEOUT ms to avoid blocking indefinitely.
 */
function loadExternalScript(oldScript: HTMLScriptElement): Promise<void> {
  // Read all properties before removing from DOM
  const src = oldScript.src;
  const type = oldScript.type;
  oldScript.remove();

  // Skip if already loaded
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  const loadPromise = new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    if (type) s.type = type;
    s.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    s.onerror = () => {
      // Intentionally not added to loadedScripts so it retries on next render
      console.error(`[generative-ui] Failed to load script: ${src}`);
      resolve(); // resolve anyway so inline scripts still run
    };
    document.head.appendChild(s);
  });

  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      console.warn(`[generative-ui] Script load timed out: ${src}`);
      resolve();
    }, SCRIPT_LOAD_TIMEOUT)
  );

  return Promise.race([loadPromise, timeout]);
}

/**
 * Execute script tags inside the shadow root with a scoped document proxy.
 * External scripts (with src) are loaded first and awaited before inline
 * scripts execute, so that libraries like Chart.js are available.
 *
 * Also injects `sendPrompt` and `openLink` into the inline script scope
 * so LLM-generated code can call them.
 */
async function activateScripts(
  shadowRoot: ShadowRoot,
  onPrompt?: (text: string) => void
) {
  const root = shadowRoot.querySelector(".gui-root");
  if (!root) return;

  const scripts = Array.from(root.querySelectorAll("script"));
  const externalScripts: HTMLScriptElement[] = [];
  const inlineScripts: HTMLScriptElement[] = [];

  for (const script of scripts) {
    if (script.src) {
      externalScripts.push(script);
    } else {
      inlineScripts.push(script);
    }
  }

  // Load all external scripts first and wait for them
  if (externalScripts.length > 0) {
    await Promise.all(externalScripts.map(loadExternalScript));
  }

  // Define sendPrompt and openLink for inline onclick handlers (global scope)
  const sendPromptFn = onPrompt
    ? (text: string) => onPrompt(text)
    : () => console.warn("[generative-ui] sendPrompt called but no onPrompt handler configured");

  const openLinkFn = (url: string) => window.open(url, "_blank", "noopener");

  // Set globals so inline event handlers (onclick, oninput, etc.) can access them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).sendPrompt = sendPromptFn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).openLink = openLinkFn;

  // Register this shadow root so the patched document methods can find
  // elements inside it, and ensure the global patches are installed.
  activeShadowRoots.add(shadowRoot);
  patchDocumentQueries();

  // Execute inline scripts via real <script> tags so that top-level function
  // and var declarations land on `window`. This is critical because LLM-generated
  // HTML uses inline event attributes (oninput="updateSim()", onclick="calculate()")
  // that resolve names in the global scope.
  //
  // The patched document.getElementById / querySelector / querySelectorAll will
  // automatically fall through to this widget's shadow root, both during initial
  // execution AND later when user interactions trigger the script's functions.
  for (const oldScript of inlineScripts) {
    const code = oldScript.textContent ?? "";
    try {
      const s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
      document.head.removeChild(s);
    } catch (err) {
      console.error("[generative-ui] Script execution error:", err);
    }
    oldScript.remove();
  }
}

/**
 * Create a widget renderer that manages Shadow DOM-based widget instances.
 */
export function createRenderer(options: WidgetRenderOptions) {
  const {
    container,
    theme = "auto",
    maxWidth = 800,
    onInteraction,
    onPrompt,
    onClose,
  } = options;

  const widgets = new Map<string, WidgetInstance>();
  /** Track all shadow style elements so setTheme() can update them */
  const shadowStyles = new Map<string, HTMLStyleElement>();
  let currentTheme = resolveTheme(theme);

  return {
    createWidget(title: string, widgetId?: string): WidgetInstance {
      const id = widgetId ?? `widget-${++widgetCounter}`;

      const wrapper = document.createElement("div");
      wrapper.className = "gui-widget-wrapper";
      wrapper.style.cssText = `
        max-width: ${maxWidth}px;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 0.5px solid var(--gui-border-primary, rgba(0,0,0,0.15));
        margin: 8px 0;
      `;

      const shadow = wrapper.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = buildThemeCSS(currentTheme);
      shadow.appendChild(styleEl);
      shadowStyles.set(id, styleEl);

      const root = document.createElement("div");
      root.className = "gui-root";
      root.id = "root";
      shadow.appendChild(root);

      container.appendChild(wrapper);

      shadow.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest?.("a[href]") as HTMLAnchorElement | null;
        if (anchor) {
          e.preventDefault();
          window.open(anchor.href, "_blank", "noopener");
        }
        const promptBtn = target.closest?.("[data-prompt]") as HTMLElement | null;
        if (promptBtn && onPrompt) {
          onPrompt(promptBtn.dataset.prompt!);
        }
      });

      let loadingEl: HTMLElement | null = null;
      let loadingTimer: ReturnType<typeof setInterval> | null = null;

      const widget: WidgetInstance = {
        id,
        title,
        container: wrapper,

        showLoading(messages?: string[]) {
          if (loadingEl) return; // already showing

          const msgs = messages && messages.length > 0 ? messages : DEFAULT_LOADING_MESSAGES;

          loadingEl = document.createElement("div");
          loadingEl.className = "gui-loading-overlay";
          loadingEl.innerHTML = `
            <div class="gui-loading-dots">
              <span class="gui-loading-dot"></span>
              <span class="gui-loading-dot"></span>
              <span class="gui-loading-dot"></span>
            </div>
            <div class="gui-loading-shimmer"></div>
            <div class="gui-loading-message">${msgs[0]}</div>
          `;
          root.appendChild(loadingEl);

          // Rotate through loading messages
          if (msgs.length > 1) {
            let msgIndex = 0;
            loadingTimer = setInterval(() => {
              if (!loadingEl) return;
              msgIndex = (msgIndex + 1) % msgs.length;
              const msgEl = loadingEl.querySelector(".gui-loading-message");
              if (msgEl) {
                msgEl.classList.add("fading-out");
                setTimeout(() => {
                  if (msgEl && loadingEl) {
                    msgEl.textContent = msgs[msgIndex];
                    msgEl.classList.remove("fading-out");
                  }
                }, 300);
              }
            }, 2500);
          }
        },

        hideLoading() {
          if (loadingTimer) {
            clearInterval(loadingTimer);
            loadingTimer = null;
          }
          if (loadingEl) {
            loadingEl.remove();
            loadingEl = null;
          }
        },

        update(html: string) {
          // Auto-hide loading when real content arrives
          if (loadingEl) {
            widget.hideLoading!();
          }

          const target = document.createElement("div");
          target.className = "gui-root";
          target.id = "root";
          target.innerHTML = html;

          morphdom(root, target, {
            onBeforeElUpdated(fromEl, toEl) {
              if (fromEl.isEqualNode(toEl)) return false;
              return true;
            },
            onNodeAdded(node) {
              if (
                node.nodeType === 1 &&
                (node as HTMLElement).tagName !== "STYLE" &&
                (node as HTMLElement).tagName !== "SCRIPT"
              ) {
                (node as HTMLElement).style.animation = "_fadeIn 0.3s ease both";
              }
              return node;
            },
          });
        },

        async activate() {
          await activateScripts(shadow, onPrompt);

          if (onInteraction) {
            shadow.addEventListener("generative-ui:interaction" as string, ((
              e: CustomEvent,
            ) => {
              onInteraction(e.detail);
            }) as EventListener);
          }
        },

        destroy() {
          if (loadingTimer) {
            clearInterval(loadingTimer);
            loadingTimer = null;
          }
          widgets.delete(id);
          shadowStyles.delete(id);
          activeShadowRoots.delete(shadow);
          wrapper.remove();
          onClose?.();
        },
      };

      widgets.set(id, widget);
      return widget;
    },

    getWidget(id: string): WidgetInstance | undefined {
      return widgets.get(id);
    },

    getAllWidgets(): WidgetInstance[] {
      return Array.from(widgets.values());
    },

    destroy() {
      for (const widget of widgets.values()) {
        widget.destroy();
      }
      widgets.clear();
      shadowStyles.clear();
    },

    /**
     * Update the theme for all existing widgets.
     * Re-generates and injects theme CSS into each widget's Shadow DOM.
     */
    setTheme(newTheme: "light" | "dark" | "auto") {
      currentTheme = resolveTheme(newTheme);
      const css = buildThemeCSS(currentTheme);
      for (const styleEl of shadowStyles.values()) {
        styleEl.textContent = css;
      }
    },
  };
}

export type WidgetRenderer = ReturnType<typeof createRenderer>;
