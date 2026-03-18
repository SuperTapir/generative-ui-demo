# generative-ui

Platform-agnostic generative UI library for LLMs. Render interactive HTML/SVG widgets from any AI model, streaming in real-time with DOM diffing.

Inspired by [Claude's generative UI system](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/) — reverse-engineered and rebuilt as a standalone web module.

## Demo

https://github.com/SuperTapir/generative-ui-demo/raw/main/assets/demo.mp4

## What it does

LLM calls a `show_widget` tool → generates HTML/SVG → the library renders it inline with streaming DOM diffing via morphdom. Charts, diagrams, interactive controls, animations — all rendered progressively as tokens arrive.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter your API key, and ask the model to visualize something.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your Application                  │
├──────────┬──────────┬───────────────┬───────────────┤
│  tools   │ adapters │   streaming   │   renderer    │
│          │          │               │               │
│ OpenAI   │ OpenAI   │ StreamEvent   │ iframe +      │
│ Anthropic│ Anthropic│ processing    │ morphdom      │
│ Generic  │          │ + debounce    │ DOM diffing   │
├──────────┴──────────┴───────────────┴───────────────┤
│              guidelines (from Claude.ai)             │
│         72KB of design rules, lazy-loaded            │
└─────────────────────────────────────────────────────┘
```

## Core concepts

### 1. Tool definitions

Get LLM-ready tool schemas for any provider:

```typescript
import { getOpenAITools, getAnthropicTools, getGenericTools } from "generative-ui";

// OpenAI function-calling format
const tools = getOpenAITools();

// Anthropic format
const tools = getAnthropicTools();

// Generic format (for custom integrations)
const tools = getGenericTools();
```

Two tools are defined:
- **`read_me`** — lazy-loads design guidelines by module (interactive, chart, diagram, mockup, art)
- **`show_widget`** — renders HTML/SVG content

### 2. Design guidelines

Extracted verbatim from Claude.ai's `visualize:read_me` tool responses. 72KB of production rules covering typography, color palettes, streaming-safe CSS patterns, Chart.js configuration, SVG diagram engineering.

```typescript
import { executeReadMe, getGuidelines } from "generative-ui";

// Execute the read_me tool (returns guidelines for the requested modules)
const guidelines = executeReadMe(["interactive", "chart"]);

// Or get guidelines directly
const content = getGuidelines(["diagram"]);
```

5 modules, loaded on demand:

| Module      | What it covers                                        |
|-------------|-------------------------------------------------------|
| interactive | Sliders, metric cards, live calculations              |
| chart       | Chart.js setup, custom legends, number formatting     |
| mockup      | UI component tokens, cards, forms, skeleton loading   |
| art         | SVG illustration, Canvas animation, creative patterns |
| diagram     | Flowcharts, architecture diagrams, SVG arrow systems  |

### 3. Widget renderer

Renders HTML in a sandboxed iframe with DOM diffing for smooth streaming:

```typescript
import { createRenderer } from "generative-ui";

const renderer = createRenderer({
  container: document.getElementById("widgets"),
  theme: "auto",        // "light" | "dark" | "auto"
  maxWidth: 800,
  onPrompt: (text) => { /* widget called sendPrompt() */ },
});

const widget = renderer.createWidget("compound_interest");
widget.update("<div>partial HTML...</div>");
widget.update("<div>more content...</div>");  // morphdom diffs, only new nodes animate
widget.activate();  // execute <script> tags
```

### 4. Streaming handler

Processes normalized stream events and manages progressive widget rendering:

```typescript
import { createStreamingHandler } from "generative-ui";

const handler = createStreamingHandler({
  renderer,
  debounceMs: 150,
  onWidgetCreated: (widget) => console.log("Widget created:", widget.title),
  onWidgetComplete: (widget) => console.log("Widget ready:", widget.title),
});

// Feed events from the adapter
handler.processEvent(event);

// Or render a complete widget directly
handler.renderWidget({
  i_have_seen_read_me: true,
  title: "my_widget",
  widget_code: "<div>complete HTML</div>",
});
```

### 5. LLM adapters

Normalize provider-specific streaming chunks into unified `StreamEvent` objects:

```typescript
import { createOpenAIAdapter, createAnthropicAdapter } from "generative-ui";

// OpenAI
const openaiAdapter = createOpenAIAdapter();
for await (const chunk of openaiStream) {
  const events = openaiAdapter.processChunk(chunk);
  for (const event of events) {
    streamingHandler.processEvent(event);
  }
}

// Anthropic
const anthropicAdapter = createAnthropicAdapter();
for await (const event of anthropicStream) {
  const events = anthropicAdapter.processEvent(event);
  for (const ev of events) {
    streamingHandler.processEvent(ev);
  }
}
```

## Streaming flow

```
LLM starts generating show_widget tool call
  │
  ├── tool_call_start → initialize streaming state
  │
  ├── tool_call_delta (repeated, every ~token)
  │   ├── debounce 150ms
  │   ├── first time: create iframe with shell HTML + morphdom
  │   ├── subsequent: postMessage → morphdom diffs old vs new DOM
  │   │   └── new nodes get 0.3s fade-in animation
  │   │   └── unchanged nodes stay untouched
  │   │
  ├── tool_call_end
  │   ├── final content update
  │   └── activate <script> tags (Chart.js, D3, etc.)
  │
  └── Widget ready for interaction
```

## Key differences from the original

| Original (pi-generative-ui) | This project |
|------------------------------|--------------|
| Pi extension API | Standalone library |
| macOS only (Glimpse/WKWebView) | Any browser (iframe sandbox) |
| Native macOS window | Inline iframe rendering |
| Pi streaming events | OpenAI / Anthropic adapters |
| Dark mode only | Light + dark + auto theme |

## Project structure

```
generative-ui/
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript type definitions
│   ├── tools.ts           # Tool schemas (OpenAI, Anthropic, Generic)
│   ├── guidelines.ts      # 72KB verbatim Claude.ai design guidelines
│   ├── svg-styles.ts      # Pre-built CSS classes for SVG diagrams
│   ├── renderer.ts        # iframe-based widget renderer with morphdom
│   ├── streaming.ts       # Streaming event handler with debouncing
│   ├── adapters/
│   │   ├── openai.ts      # OpenAI streaming adapter
│   │   ├── anthropic.ts   # Anthropic streaming adapter
│   │   └── index.ts
│   └── claude-guidelines/ # Raw extracted markdown (reference)
│       ├── CORE.md
│       ├── art.md, chart.md, diagram.md, ...
│       └── sections/      # Deduplicated sections + mapping.json
├── demo/
│   ├── index.html         # Demo chat UI
│   ├── main.ts            # Demo logic with full OpenAI/Anthropic support
│   └── style.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Credits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — the original reverse-engineering and implementation
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM diffing for smooth streaming
- Anthropic — for building the generative UI system

## License

MIT
