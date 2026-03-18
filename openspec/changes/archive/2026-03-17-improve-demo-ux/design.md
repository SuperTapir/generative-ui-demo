## Context

The generative-ui library already defines a `loading_messages` parameter in the `show_widget` tool schema, but the streaming handler and renderer ignore it. The demo chat renders LLM text as plain text with no Markdown support. Both issues degrade the demo experience, making it feel unfinished.

The reference implementation (pi-generative-ui) relies on a native macOS window that opens instantly and progressive morphdom diffing to create a seamless feel. In a browser-based demo, the latency between "Thinking..." and visible widget content is more noticeable and needs explicit visual feedback.

## Goals / Non-Goals

- Goals:
  - Show a loading overlay on the widget container during streaming, using `loading_messages` from the LLM when available
  - Render assistant text as formatted Markdown in the demo chat
  - Keep changes minimal and scoped — no new npm dependencies for the library core

- Non-Goals:
  - Full rich-text editor or chat UI framework
  - Loading states for the library's public API beyond what `loading_messages` enables (consumers can implement their own)
  - Server-side Markdown rendering

## Decisions

### Widget loading overlay

- **Decision:** Render a loading overlay inside the widget's Shadow DOM container. The overlay shows animated dots and cycles through `loading_messages` (if provided) or displays a default "Rendering widget..." message.
- **Alternatives considered:**
  - Skeleton screen inside the widget — too complex for arbitrary LLM-generated content; we don't know the layout ahead of time.
  - External loading indicator outside the widget — loses spatial association; user doesn't know what's loading.
- **Implementation:** `createWidget()` in `renderer.ts` renders the overlay immediately. The first `widget.update()` call with real HTML dismisses the overlay (fade-out transition). The overlay is pure CSS — no JS animation library.

### Streaming handler changes

- **Decision:** `streaming.ts` will extract `loading_messages` and `title` from partial args during `tool_call_start` or early `tool_call_delta` events. It passes these to `renderer.createWidget()` so the overlay can display them immediately.
- **Rationale:** The LLM typically emits `title` and `loading_messages` before `widget_code` in the JSON, so they're available early in the stream.

### Demo Markdown rendering

- **Decision:** Use `marked` library loaded from CDN (`cdn.jsdelivr.net`) in the demo. Parse assistant text with `marked.parse()` and set `innerHTML` instead of `textContent`. Sanitize via `DOMPurify` (also CDN) to prevent XSS.
- **Alternatives considered:**
  - `markdown-it` — slightly heavier, similar capability. `marked` is more widely used and smaller.
  - Custom regex-based Markdown — fragile, doesn't handle edge cases.
  - Bundle as npm dependency — adds build complexity to the demo, which is meant to be a simple Vite dev server.
- **Implementation:** Load both `marked` and `DOMPurify` via `<script>` tags in `demo/index.html`. Update `demo/main.ts` to use `window.marked.parse()` + `window.DOMPurify.sanitize()` for assistant text. Add prose styling in `demo/style.css`.

## Risks / Trade-offs

- **CDN dependency for demo:** If CDN is unreachable, Markdown won't render. Acceptable for a demo — fallback is raw text (current behavior). Can document this.
- **Loading message timing:** `loading_messages` may not be available in the very first streaming delta if the LLM orders JSON keys differently. Mitigation: fall back to a default message and update when `loading_messages` arrives.
- **XSS surface:** Using `innerHTML` for Markdown output introduces XSS risk. Mitigation: DOMPurify sanitization.

## Open Questions

- None — scope is well-defined and changes are additive.
