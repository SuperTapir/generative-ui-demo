# generative-ui

[English](./README.md) | [简体中文](./README.zh-CN.md)

Platform-agnostic generative UI library for LLMs. Render interactive HTML/SVG widgets from any AI model, streaming in real-time with DOM diffing.

Inspired by [Claude's generative UI system](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/) — reverse-engineered and rebuilt as standalone packages.

## Demo

https://github.com/user-attachments/assets/1cb88122-0fe3-4e12-8d09-593df393122a

## What it does

LLM calls a `show_widget` tool → generates HTML/SVG → the library renders it inline with streaming DOM diffing via morphdom. Charts, diagrams, interactive controls, animations — all rendered progressively as tokens arrive.

## Packages

| Package | Language | Install | Purpose |
|---------|----------|---------|---------|
| [`generative-ui`](./packages/js/) | JS/TS | `npm install generative-ui` | Frontend renderer, streaming, adapters, tool schemas |
| [`generative-ui`](./packages/python/) | Python | `pip install generative-ui` | Tool schemas + system prompt for Python backends |
| [Demo app](./demo/) | Python + JS | See below | Reference "bring your own backend" implementation |

## Quick start

### 1. Get tool schemas (any backend)

**Python backend:**

```python
from generative_ui import get_tools, get_system_prompt, execute_read_me
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    system=get_system_prompt(),
    tools=get_tools(),               # Anthropic format by default
    messages=[{"role": "user", "content": "Draw a flowchart"}],
)

# Handle read_me tool calls
for block in response.content:
    if block.type == "tool_use" and block.name == "read_me":
        result = execute_read_me(block.input["modules"])
```

**JS/TS backend (any framework):**

```typescript
import { getAnthropicTools, getSystemPromptSnippet, executeReadMe } from "generative-ui";

// Pass these to your LLM call
const tools = getAnthropicTools();    // or getOpenAITools()
const system = getSystemPromptSnippet();

// Handle read_me tool calls
const guidelines = executeReadMe(["interactive", "chart"]);
```

### 2. Render widgets (frontend)

```typescript
import {
  createRenderer,
  createStreamingHandler,
  createAnthropicAdapter,
} from "generative-ui";

// 1. Create a renderer targeting a DOM container
const renderer = createRenderer({
  container: document.getElementById("widgets")!,
  theme: "auto",
});

// 2. Create a streaming handler
const handler = createStreamingHandler({
  renderer,
  onWidgetCreated: (w) => console.log("Widget created:", w.title),
  onWidgetComplete: (w) => console.log("Widget ready:", w.title),
});

// 3. Parse streaming response with an adapter
const adapter = createAnthropicAdapter();
// ... feed SSE events through adapter.processEvent() → handler.processEvent()
```

See the [demo app](./demo/) for a complete working example.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Your Application                     │
├──────────────────────┬──────────────────────────────┤
│      Frontend (JS)   │      Backend (any language)   │
│                      │                               │
│  renderer (Shadow    │  Python: get_tools(),          │
│    DOM + morphdom)   │    get_system_prompt()         │
│  streaming handler   │  JS: getAnthropicTools(),      │
│  adapters (OpenAI/   │    getSystemPromptSnippet()    │
│           Anthropic) │  YOUR LLM API call             │
├──────────────────────┴──────────────────────────────┤
│           guidelines (from Claude.ai)                 │
│        72KB of design rules, lazy-loaded              │
└─────────────────────────────────────────────────────┘
```

### JS package exports

| Import path | Content | Runtime |
|---|---|---|
| `generative-ui` | Renderer, streaming, adapters, tools, types | Browser/Node |
| `generative-ui/renderer` | Renderer only (tree-shake) | Browser |
| `generative-ui/adapters/openai` | OpenAI adapter only | Isomorphic |
| `generative-ui/adapters/anthropic` | Anthropic adapter only | Isomorphic |

## Core concepts

### 1. Tool definitions

Get LLM-ready tool schemas for any provider:

```typescript
import { getOpenAITools, getAnthropicTools, getGenericTools } from "generative-ui";
```

Two tools are defined:
- **`read_me`** — lazy-loads design guidelines by module (interactive, chart, diagram, mockup, art)
- **`show_widget`** — renders HTML/SVG content

### 2. Design guidelines

Extracted verbatim from Claude.ai's `visualize:read_me` tool responses. 72KB of production rules covering typography, color palettes, streaming-safe CSS patterns, Chart.js configuration, SVG diagram engineering.

| Module      | What it covers                                        |
|-------------|-------------------------------------------------------|
| interactive | Sliders, metric cards, live calculations              |
| chart       | Chart.js setup, custom legends, number formatting     |
| mockup      | UI component tokens, cards, forms, skeleton loading   |
| art         | SVG illustration, Canvas animation, creative patterns |
| diagram     | Flowcharts, architecture diagrams, SVG arrow systems  |

### 3. Widget renderer

Shadow DOM-based renderer with streaming-optimized DOM diffing:

```typescript
import { createRenderer } from "generative-ui";

const renderer = createRenderer({
  container: document.getElementById("widgets"),
  theme: "auto",        // "light" | "dark" | "auto"
  maxWidth: 800,
  onPrompt: (text) => { /* widget called sendPrompt() */ },
});
```

### 4. LLM adapters

Normalize provider-specific streaming chunks into unified `StreamEvent` objects:

```typescript
import { createOpenAIAdapter, createAnthropicAdapter } from "generative-ui";
```

## Running the demo

The demo uses a Python FastAPI backend (managed by [uv](https://docs.astral.sh/uv/)) + vanilla JS frontend.

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.9+ and [uv](https://docs.astral.sh/uv/)
- An Anthropic API key (or compatible proxy)

### Setup

```bash
git clone https://github.com/anthropics/generative-ui.git
cd generative-ui

# Install JS dependencies and build the JS SDK
pnpm install
pnpm build:js

# Install demo backend dependencies
cd demo/backend
uv sync

# Configure environment
cp .env.example .env
# Edit .env — set your API key, base URL, model
```

`.env` example:

```bash
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_BASE_URL=http://localhost:8082   # optional, for proxy/gateway
ANTHROPIC_MODEL=claude-sonnet-4-6          # optional, default: claude-sonnet-4-6
```

### Run

In two terminals:

```bash
# Terminal 1: Start FastAPI backend
cd demo/backend
uv run --env-file .env uvicorn main:app --reload --port 8000

# Terminal 2: Start Vite frontend (from project root)
pnpm dev:frontend
```

Open http://localhost:3000

## Project structure

```
generative-ui/
├── packages/
│   ├── js/                    # JS/TS client SDK (npm: generative-ui)
│   │   ├── src/
│   │   │   ├── index.ts       # Barrel export
│   │   │   ├── types.ts       # TypeScript types
│   │   │   ├── tools.ts       # Tool schemas + system prompt
│   │   │   ├── guidelines.ts  # 72KB Claude.ai design guidelines
│   │   │   ├── renderer.ts    # Shadow DOM renderer + morphdom
│   │   │   ├── streaming.ts   # Streaming event handler
│   │   │   ├── svg-styles.ts  # CSS classes for SVG diagrams
│   │   │   └── adapters/      # OpenAI + Anthropic adapters
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── python/                # Python SDK (pip: generative-ui)
│       ├── src/generative_ui/
│       │   ├── __init__.py    # get_tools(), get_system_prompt()
│       │   ├── tools.py       # Tool schemas (Anthropic + OpenAI)
│       │   ├── prompt.py      # System prompt builder
│       │   ├── guidelines.py  # Guidelines loader
│       │   └── data/guidelines/  # Markdown guideline files
│       └── pyproject.toml
├── demo/
│   ├── backend/               # FastAPI demo server
│   │   ├── main.py
│   │   └── pyproject.toml
│   └── frontend/              # Vanilla JS/TS demo client
│       ├── index.html
│       ├── main.ts
│       ├── style.css
│       ├── vite.config.ts
│       └── package.json
├── pnpm-workspace.yaml
└── package.json               # Workspace root
```

## Credits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — the original reverse-engineering and implementation
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM diffing for smooth streaming
- Anthropic — for building the generative UI system

## License

MIT
