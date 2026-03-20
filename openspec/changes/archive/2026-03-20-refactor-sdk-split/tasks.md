## 1. Monorepo Setup
- [x] 1.1 Create `pnpm-workspace.yaml` with `packages/js` and `demo/frontend`
- [x] 1.2 Create root `package.json` with workspace scripts

## 2. JS Client SDK (`packages/js/`)
- [x] 2.1 Create `packages/js/package.json` (name: `generative-ui`, exports: `.`, `./renderer`, `./adapters/openai`, `./adapters/anthropic`)
- [x] 2.2 Create `packages/js/tsconfig.json`
- [x] 2.3 Create `packages/js/tsup.config.ts`
- [x] 2.4 Move `src/index.ts`, `src/types.ts`, `src/renderer.ts`, `src/streaming.ts`, `src/svg-styles.ts`, `src/guidelines.ts`, `src/tools.ts` to `packages/js/src/`
- [x] 2.5 Move `src/adapters/` to `packages/js/src/adapters/`
- [x] 2.6 Remove `src/server/` directory (middleware.ts, handler.ts, index.ts)
- [x] 2.7 Update `packages/js/src/index.ts` — remove server re-exports, keep tool/guideline exports
- [x] 2.8 Verify `pnpm build` succeeds in `packages/js/`

## 3. Python SDK (`packages/python/`)
- [x] 3.1 Create `packages/python/pyproject.toml` (name: `generative-ui`, build: hatchling)
- [x] 3.2 Create `packages/python/src/generative_ui/__init__.py` with `get_tools()` and `get_system_prompt()`
- [x] 3.3 Create `packages/python/src/generative_ui/tools.py` — tool schema definitions (Anthropic + OpenAI formats)
- [x] 3.4 Create `packages/python/src/generative_ui/prompt.py` — system prompt builder
- [x] 3.5 Extract guidelines from JS `guidelines.ts` to `packages/python/src/generative_ui/data/guidelines/*.md` (core.md, interactive.md, chart.md, diagram.md, mockup.md, art.md)
- [x] 3.6 Verify `pip install -e .` succeeds and `from generative_ui import get_tools, get_system_prompt` works

## 4. Demo App (`demo/`)
- [x] 4.1 Create `demo/backend/pyproject.toml` (deps: generative-ui, anthropic, fastapi, uvicorn, sse-starlette)
- [x] 4.2 Create `demo/backend/.env.example` with `ANTHROPIC_API_KEY=`
- [x] 4.3 Create `demo/backend/main.py` — FastAPI server with:
  - `POST /api/chat` — accept messages, call Anthropic streaming API using generative-ui tools/prompt, SSE response
  - Tool execution loop (handle `read_me` tool calls server-side, continue conversation)
- [x] 4.4 Create `demo/frontend/package.json` (deps: generative-ui JS)
- [x] 4.5 Create `demo/frontend/vite.config.ts` (proxy `/api` to FastAPI backend)
- [x] 4.6 Create `demo/frontend/index.html` + `demo/frontend/main.ts` — chat UI using adapters + streaming handler + renderer
- [x] 4.7 End-to-end test: start backend + frontend, send message, see streaming widget render

## 5. Cleanup
- [x] 5.1 Remove root-level `src/`, `tsup.config.ts`, `tsconfig.json`, `vite.config.js`
- [x] 5.2 Remove `examples/demo-chat/` directory
- [x] 5.3 Remove old `demo/` directory (replaced by new demo/)
- [x] 5.4 Update root `package.json` to workspace-only (no direct build/exports)
- [x] 5.5 Update README.md and README.zh-CN.md with new usage instructions
