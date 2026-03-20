## ADDED Requirements

### Requirement: Demo FastAPI Backend
The demo SHALL include a Python FastAPI backend that demonstrates the "bring your own backend" integration pattern.

The backend SHALL use the `generative-ui` Python package to obtain tool definitions and system prompt, and call the Anthropic API directly using the `anthropic` Python SDK.

The backend SHALL expose:
- `POST /api/chat` — Accepts a JSON body with `messages` array, streams LLM response as SSE events

The backend SHALL handle the `read_me` tool call server-side: when the LLM calls `read_me`, the backend SHALL execute it locally (loading the requested guideline modules), send the tool result back to the LLM, and continue streaming the follow-up response.

#### Scenario: User sends message and receives streaming widget
- **WHEN** the frontend sends `POST /api/chat` with `{"messages": [{"role": "user", "content": "Create a compound interest calculator"}]}`
- **THEN** the backend calls Anthropic API with streaming enabled, using tools and system prompt from the `generative-ui` Python package
- **AND** the SSE events are forwarded to the frontend in Anthropic streaming format
- **AND** when the LLM calls `read_me`, the backend handles it transparently and continues the conversation

#### Scenario: Multi-turn conversation
- **WHEN** the frontend sends a follow-up message with full conversation history
- **THEN** the backend processes the complete message history and streams the response

### Requirement: Demo Vanilla JS Frontend
The demo SHALL include a vanilla TypeScript frontend (built with Vite) that uses the `generative-ui` JS package to render streaming widgets.

The frontend SHALL use:
- `createAnthropicAdapter` to parse SSE events from the FastAPI backend
- `createStreamingHandler` to coordinate widget lifecycle
- `createRenderer` to render widgets in Shadow DOM containers

The frontend SHALL provide a chat interface with message input and widget display area.

#### Scenario: End-to-end widget rendering
- **WHEN** the user types a message in the chat input
- **THEN** the frontend sends the message to `POST /api/chat`
- **AND** processes the SSE stream using the Anthropic adapter
- **AND** progressively renders the widget as tokens arrive
- **AND** the final widget is interactive (scripts execute, user can interact)
