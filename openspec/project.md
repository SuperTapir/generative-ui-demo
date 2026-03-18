# Project Context

## Purpose

Platform-agnostic generative UI library for LLMs. Enables any AI model to render interactive HTML/SVG widgets inline, with real-time streaming and DOM diffing.

Inspired by [Claude's generative UI system](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/) — reverse-engineered from Claude.ai and rebuilt as a standalone, browser-based library that works with any LLM provider.

Core goals:
- Provide LLM-ready tool schemas (`read_me`, `show_widget`) for OpenAI, Anthropic, and generic integrations
- Stream partial HTML/SVG as tokens arrive and progressively render via morphdom DOM diffing
- Ship 72KB of production design guidelines (extracted verbatim from Claude.ai) covering charts, diagrams, interactive controls, mockups, and art
- Run in any browser via sandboxed iframes with light/dark/auto theme support

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022 target)
- **Build:** Vite 6 (library mode for `dist/`, dev server with custom API plugin for the demo)
- **Module system:** ESM-only (`"type": "module"` in package.json)
- **DOM diffing:** morphdom ^2.7.8 (the only runtime dependency)
- **Type declarations:** vite-plugin-dts for `.d.ts` generation
- **TypeScript:** ^5.7, `moduleResolution: "bundler"`, strict enabled
- **Demo server:** Vite dev server + custom Vite plugin (`apiPlugin`) that proxies `/api/chat` and `/api/chat/continue` to upstream LLM APIs (Anthropic or OpenAI)
- **Package manager:** pnpm

## Project Conventions

### Code Style

- **No linter/formatter config** in the repo — no ESLint or Prettier configured at the project level
- **Functional API:** public surface uses factory functions (`createRenderer`, `createStreamingHandler`, `createOpenAIAdapter`, `createAnthropicAdapter`) — no classes exposed
- **Naming:**
  - Files: `kebab-case.ts` (e.g., `svg-styles.ts`, `streaming.ts`)
  - Types/interfaces: `PascalCase` (e.g., `WidgetInstance`, `StreamEvent`)
  - Functions: `camelCase` (e.g., `createRenderer`, `getOpenAITools`)
  - Tool names and widget titles: `snake_case` (e.g., `show_widget`, `read_me`)
- **Exports:** Barrel file at `src/index.ts` re-exports everything; types are exported separately with `export type`
- **Sub-path exports:** `package.json` exposes `.`, `./renderer`, `./adapters/openai`, `./adapters/anthropic`
- **JS extension in imports:** All internal imports use `.js` extension (e.g., `from "./types.js"`) for ESM compatibility

### Architecture Patterns

The library is organized into five composable layers:

1. **Tools** (`tools.ts`) — LLM tool schema definitions in OpenAI, Anthropic, and generic formats. Also contains `executeReadMe` for server-side guideline resolution.
2. **Guidelines** (`guidelines.ts`) — 72KB of design rules extracted from Claude.ai, loaded on-demand by module (`interactive`, `chart`, `diagram`, `mockup`, `art`).
3. **Renderer** (`renderer.ts`) — Creates sandboxed widget containers using Shadow DOM. Uses morphdom for incremental DOM diffing during streaming. Patches global `document` query methods so LLM-generated scripts can find elements inside shadow roots.
4. **Streaming** (`streaming.ts`) — Manages active tool-call streams, batches updates via `requestAnimationFrame`, and coordinates widget lifecycle (create → update → activate).
5. **Adapters** (`adapters/`) — Normalize provider-specific streaming chunks (OpenAI deltas, Anthropic SSE events) into a unified `StreamEvent` interface.

The demo app (`demo/`) is a separate Vite root that uses the library through a custom Vite plugin providing `/api/chat` and `/api/chat/continue` endpoints as a proxy to upstream LLM APIs.

### Testing Strategy

No tests are currently set up. No test framework, test files, or coverage configuration exists in the project. This is an area for future improvement.

### Git Workflow

- **Commit format:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`)
- **.gitignore:** `node_modules/`, `dist/`, `*.tsbuildinfo`, `.DS_Store`, `.env`
- **Sensitive files:** API keys stored in `.env` (gitignored), never committed

## Domain Context

- **Generative UI:** The concept of LLMs generating interactive visual content (HTML/SVG widgets) rather than just text responses. The LLM calls a `show_widget` tool with HTML code, and the library renders it progressively.
- **Tool calling / Function calling:** The mechanism by which LLMs invoke structured tools. This library provides tool schemas in both OpenAI and Anthropic formats.
- **Streaming DOM diffing:** As the LLM generates tokens, partial HTML is streamed to the renderer. morphdom diffs the old and new DOM trees so only changed nodes are updated, providing smooth progressive rendering.
- **Design guidelines:** 72KB of production rules originally from Claude.ai's `visualize:read_me` tool. These tell the LLM how to structure widgets (typography, color palettes, Chart.js config, SVG patterns, etc.). Organized into 5 lazy-loaded modules.
- **`read_me` / `show_widget` protocol:** A two-tool workflow — the LLM first calls `read_me` (silently) to load relevant design guidelines, then calls `show_widget` with the complete HTML/SVG implementation.

## Important Constraints

- **Zero runtime dependencies beyond morphdom** — the library must stay lightweight; no frameworks (React, Vue, etc.)
- **ESM-only** — no CommonJS support
- **Browser-only renderer** — `renderer.ts` and `streaming.ts` use DOM APIs; only `tools.ts` and `guidelines.ts` are environment-agnostic
- **Sandboxed rendering** — widgets render inside Shadow DOM containers to prevent style/script leakage
- **No bundled LLM SDK** — the library provides tool schemas and adapters but does not bundle OpenAI or Anthropic SDKs; consumers bring their own

## External Dependencies

- **Anthropic API** — Claude models via `https://api.anthropic.com/v1/messages` (SSE streaming)
- **OpenAI API** — GPT models via `https://api.openai.com/v1/chat/completions` (SSE streaming)
- **CDN libraries** (used by LLM-generated widget code at runtime):
  - `cdnjs.cloudflare.com` — Chart.js, D3, and other visualization libraries
  - `cdn.jsdelivr.net`
  - `unpkg.com`
  - `esm.sh`
- **morphdom** (npm) — the sole runtime dependency for DOM diffing
