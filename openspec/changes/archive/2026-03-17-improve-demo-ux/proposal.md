# Change: Improve demo UX with widget loading states and Markdown rendering

## Why

Two pain points in the current demo experience:

1. **Long perceived wait time.** After the user sends a message, the LLM often calls `read_me` first (silently), then generates `show_widget`. During this period there is only a generic "Thinking..." indicator. Once the tool call starts, the widget container doesn't appear until 20+ characters of HTML arrive. The `loading_messages` parameter is defined in the tool schema but never rendered — so LLM-provided loading hints are silently discarded.

2. **Raw Markdown in chat.** LLM text responses are rendered via `textEl.textContent`, which escapes all formatting. Headings, bold, lists, code blocks, and links display as raw Markdown syntax.

## What Changes

- **Widget loading overlay:** Implement the `loading_messages` parameter — show a loading overlay with the LLM-provided messages (or a sensible default) from `tool_call_start` until the first meaningful HTML chunk renders. This bridges the perceived gap between "Thinking..." and visible widget content.
- **Demo Markdown rendering:** Add a lightweight Markdown-to-HTML renderer (marked via CDN or bundled) so assistant text in the demo chat renders with proper formatting.

## Impact

- Affected specs: `widget-loading` (new), `demo-markdown` (new)
- Affected code:
  - `src/streaming.ts` — pass `loading_messages` through to renderer
  - `src/renderer.ts` — render loading overlay on widget creation, dismiss on first content update
  - `demo/main.ts` — replace `textContent` with Markdown-rendered `innerHTML`
  - `demo/style.css` — loading overlay styles, Markdown prose styles
  - `demo/index.html` — add marked library (CDN)
