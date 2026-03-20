## ADDED Requirements

### Requirement: JS Client Package
The project SHALL provide a standalone npm package (`generative-ui`) that exports:
- Frontend rendering pipeline: `createRenderer`, `createStreamingHandler`, `createOpenAIAdapter`, `createAnthropicAdapter`
- Tool definitions: `getAnthropicTools()`, `getOpenAITools()`, `getGenericTools()`
- System prompt: `getSystemPromptSnippet()`
- Guidelines: `getGuidelines()`, `AVAILABLE_MODULES`, `executeReadMe()`
- All TypeScript types

The package SHALL NOT export any backend middleware, HTTP handlers, or server-specific code.

The package SHALL provide sub-path exports:
- `.` — Full client (adapters + streaming + renderer + tools)
- `./renderer` — Renderer only
- `./adapters/openai` — OpenAI adapter only
- `./adapters/anthropic` — Anthropic adapter only

#### Scenario: JS backend user imports tool definitions
- **WHEN** a developer using any JS/TS backend framework imports `getAnthropicTools()` from `generative-ui`
- **THEN** they receive the tool schemas as plain objects ready to pass to the Anthropic SDK `client.messages.create({ tools })` call
- **AND** no Express, Connect, or framework-specific code is included

#### Scenario: Frontend user imports rendering pipeline
- **WHEN** a developer imports `createRenderer`, `createStreamingHandler`, and `createAnthropicAdapter` from `generative-ui`
- **THEN** they can wire these to any SSE source to render streaming widgets
- **AND** no server-side code is bundled into the frontend
