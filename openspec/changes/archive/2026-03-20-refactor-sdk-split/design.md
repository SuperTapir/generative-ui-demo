## Context

The project is a single npm package that bundles both a frontend rendering pipeline and a backend Express middleware. Research shows comparable open-source projects (Vercel AI SDK, CopilotKit, Tambo, json-render) all separate backend concerns from frontend rendering, and none force users to adopt a specific backend framework.

This refactoring splits the project into three pieces:
1. JS client SDK (rendering pipeline + tool definitions)
2. Python SDK (tool definitions + system prompt for Python backends)
3. Demo app (reference implementation showing how to integrate both)

## Goals / Non-Goals

**Goals:**
- Allow users with any backend (Python, Go, Rust, Java…) to use the tool definitions and system prompt
- Allow users with any JS/TS backend (Next.js, Hono, Fastify, Express) to import tool schemas directly
- Provide a working demo that shows the "bring your own backend" integration pattern
- Maintain all existing frontend rendering capabilities

**Non-Goals:**
- React/Vue/Svelte wrapper components (future work)
- Go/Rust/Java backend SDKs (not enough demand yet)
- Hosted backend service (like Tambo Cloud)
- Changing the widget rendering mechanism (Shadow DOM, morphdom, etc.)

## Decisions

### 1. Monorepo with pnpm workspaces

- **Decision:** Keep everything in one repo, use `pnpm-workspace.yaml` for JS packages. Python package lives alongside but uses its own `pyproject.toml`.
- **Rationale:** One repo makes cross-package changes atomic. CopilotKit uses the same pattern (JS + Python in one monorepo). pnpm workspaces only manage JS packages; Python builds independently.
- **Alternatives:** Separate repos (rejected — harder to keep tool schemas in sync between JS and Python packages).

### 2. Remove server middleware entirely

- **Decision:** Delete `src/server/middleware.ts` and `src/server/handler.ts`. Do not replace with a "lighter" middleware.
- **Rationale:** The framework-agnostic pure functions (`getAnthropicTools()`, `buildSystemPrompt()`, `executeReadMe()`) remain in the JS package and are sufficient for any backend. A middleware abstraction adds no value for a library whose backend surface is "pass these JSON schemas to your LLM call."
- **Alternatives:** (a) Keep middleware as optional — rejected, it's a maintenance burden and confuses the narrative; (b) Create adapter middleware for multiple frameworks — rejected, too much scope.

### 3. Python package as thin data wrapper

- **Decision:** Python package contains only tool schemas (as dicts) + system prompt (as string) + guideline text files. No HTTP handling, no streaming, no LLM SDK dependency.
- **Rationale:** Python backend users only need two things: `get_tools()` and `get_system_prompt()`. Everything else (calling LLM, streaming SSE, etc.) is the user's responsibility. This matches how Vercel AI SDK's `streamText()` works — the SDK provides tools, the user handles the transport.
- **Alternatives:** Full Python SDK with streaming support — rejected, would duplicate work already done well by `anthropic` and `openai` Python SDKs.

### 4. Guidelines stored as markdown files in Python package

- **Decision:** Extract the 72KB guidelines from `guidelines.ts` string literals into separate `.md` files under `packages/python/src/generative_ui/data/guidelines/`. Python reads them via `importlib.resources`. JS package continues to use inline strings in `guidelines.ts`.
- **Rationale:** Markdown files are easier to maintain and review than escaped strings inside Python code. `importlib.resources` is the standard way to package data files in Python.
- **Alternatives:** Embed guidelines as Python string constants — rejected, 72KB of escaped strings is unreadable.

### 5. Demo uses FastAPI + vanilla JS

- **Decision:** Backend in FastAPI (Python), frontend in vanilla TypeScript + Vite. Frontend imports `generative-ui` JS package.
- **Rationale:** FastAPI is the most popular Python web framework for AI apps. Vanilla JS frontend (no React) matches the library's framework-agnostic philosophy. This combination best demonstrates the "bring your own backend" pattern across language boundaries.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking change for existing `generative-ui/server` users | Document migration path in CHANGELOG; the server functions were only usable with Express anyway |
| Guidelines drift between JS and Python packages | Single source of truth: markdown files. JS `guidelines.ts` is generated from the same markdown content. Add a build-time check. |
| Demo complexity (two processes: Python + Vite) | Provide a single `start.sh` / Makefile that launches both |

## Open Questions

- None at this time. All major decisions are resolved.
