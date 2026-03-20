# Change: Refactor into JS Client SDK + Python SDK + Demo App

## Why

The current single-package architecture has two problems:

1. **Backend middleware is too invasive** — `createMiddleware()` takes over users' API routes (`/chat`, `/chat/continue`, `/config`), making it hard for teams with existing backends to adopt the library.
2. **Only Express is supported** — The middleware uses Connect/Express `(req, res, next)` signatures, excluding Hono, Fastify, Next.js API Routes, Flask, FastAPI, Django, etc.

The real value of this project is: (a) the 72KB design guidelines, (b) the tool schemas (`read_me` + `show_widget`), and (c) the frontend rendering pipeline (adapters + streaming handler + renderer). The backend proxy layer is convenience, not core.

## What Changes

- **BREAKING**: Remove `generative-ui/server` export path (middleware + handler)
- **BREAKING**: Remove `createMiddleware()`, `buildLLMRequest()`, `streamLLMResponse()` from public API
- Keep `getAnthropicTools()`, `getOpenAITools()`, `getSystemPromptSnippet()`, `executeReadMe()` in JS package main entry (these are framework-agnostic pure functions)
- Create `generative-ui` Python package (`pip install generative-ui`) providing `get_tools()` and `get_system_prompt()`
- Create demo app using Python FastAPI backend + vanilla JS frontend to demonstrate the "bring your own backend" pattern
- Restructure repo as pnpm monorepo: `packages/js/`, `packages/python/`, `demo/`

## Impact

- Affected specs: `widget-loading`, `widget-theming`, `demo-markdown` (demo moves to new location)
- Affected code: All source files move under `packages/js/src/`, server directory removed, new Python package created, demo rewritten
- Users currently using `generative-ui/server` must migrate to calling LLM APIs directly (using tool schemas from the JS or Python package)
