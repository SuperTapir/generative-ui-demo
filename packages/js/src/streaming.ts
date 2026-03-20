import type { ShowWidgetParams, StreamEvent, WidgetInstance } from "./types.js";
import type { WidgetRenderer } from "./renderer.js";

export interface StreamingOptions {
  renderer: WidgetRenderer;
  onWidgetCreated?: (widget: WidgetInstance) => void;
  onWidgetComplete?: (widget: WidgetInstance) => void;
}

interface ActiveStream {
  toolCallId: string;
  widget: WidgetInstance | null;
  lastHTML: string;
  dirty: boolean;
  rafId: number | null;
  title: string;
  loadingMessages?: string[];
}

/**
 * Creates a streaming handler that processes LLM stream events
 * and renders widgets progressively via DOM diffing.
 *
 * Uses requestAnimationFrame for batching — guarantees at least
 * one visual update per animation frame regardless of how many
 * deltas arrive in a burst.
 */
export function createStreamingHandler(options: StreamingOptions) {
  const { renderer, onWidgetCreated, onWidgetComplete } = options;

  const activeStreams = new Map<string, ActiveStream>();

  function processEvent(event: StreamEvent) {
    switch (event.type) {
      case "tool_call_start":
        handleStart(event);
        break;
      case "tool_call_delta":
        handleDelta(event);
        break;
      case "tool_call_end":
        handleEnd(event);
        break;
    }
  }

  function handleStart(event: StreamEvent) {
    if (event.toolName !== "show_widget") return;

    const stream: ActiveStream = {
      toolCallId: event.toolCallId,
      widget: null,
      lastHTML: "",
      dirty: false,
      rafId: null,
      title: "widget",
      loadingMessages: event.partialArgs?.loading_messages,
    };

    activeStreams.set(event.toolCallId, stream);

    // Create widget immediately and show loading state
    const widget = ensureWidget(stream);
    widget.showLoading?.(stream.loadingMessages);
    onWidgetCreated?.(widget);
  }

  function ensureWidget(stream: ActiveStream): WidgetInstance {
    if (!stream.widget) {
      const title = stream.title.replace(/_/g, " ");
      stream.widget = renderer.createWidget(title, stream.toolCallId);
    }
    return stream.widget;
  }

  function flushUpdate(stream: ActiveStream) {
    stream.rafId = null;
    if (!stream.dirty) return;
    stream.dirty = false;
    const widget = ensureWidget(stream);
    widget.update(stream.lastHTML);
  }

  function handleDelta(event: StreamEvent) {
    if (event.toolName !== "show_widget") return;

    const stream = activeStreams.get(event.toolCallId);
    if (!stream) return;

    // Capture loading messages if they arrive in a delta
    if (event.partialArgs?.loading_messages && !stream.loadingMessages) {
      stream.loadingMessages = event.partialArgs.loading_messages;
      if (stream.widget) {
        stream.widget.showLoading?.(stream.loadingMessages);
      }
    }

    const html = event.partialArgs?.widget_code;
    if (!html || html.length < 20 || html === stream.lastHTML) return;

    if (event.partialArgs?.title) {
      stream.title = event.partialArgs.title;
    }

    stream.lastHTML = html;
    stream.dirty = true;

    if (stream.rafId == null) {
      stream.rafId = requestAnimationFrame(() => flushUpdate(stream));
    }
  }

  function handleEnd(event: StreamEvent) {
    if (event.toolName !== "show_widget") return;

    const stream = activeStreams.get(event.toolCallId);
    if (!stream) return;

    if (stream.rafId != null) {
      cancelAnimationFrame(stream.rafId);
      stream.rafId = null;
    }

    const finalHTML = event.args?.widget_code ?? stream.lastHTML;
    if (event.args?.title) stream.title = event.args.title;

    const widget = ensureWidget(stream);
    widget.hideLoading?.();
    widget.update(finalHTML);

    setTimeout(async () => {
      try {
        await widget.activate();
      } catch (err) {
        console.error("[generative-ui] Widget activation error:", err);
      }
      onWidgetComplete?.(widget);
    }, 100);

    activeStreams.delete(event.toolCallId);
  }

  return {
    processEvent,

    renderWidget(params: ShowWidgetParams): WidgetInstance {
      const title = params.title.replace(/_/g, " ");
      const widget = renderer.createWidget(title);
      widget.update(params.widget_code);
      setTimeout(async () => {
        try {
          await widget.activate();
        } catch (err) {
          console.error("[generative-ui] Widget activation error:", err);
        }
      }, 100);
      return widget;
    },

    isStreaming(): boolean {
      return activeStreams.size > 0;
    },

    destroy() {
      for (const stream of activeStreams.values()) {
        if (stream.rafId != null) cancelAnimationFrame(stream.rafId);
      }
      activeStreams.clear();
    },
  };
}

export type StreamingHandler = ReturnType<typeof createStreamingHandler>;
