## ADDED Requirements

### Requirement: Python SDK Package
The project SHALL provide a Python package (`generative-ui`) installable via `pip install generative-ui` that exports:
- `get_tools(format)` — Returns tool definitions as a list of dicts. The `format` parameter SHALL accept `"anthropic"` or `"openai"` and return the corresponding schema format.
- `get_system_prompt()` — Returns the complete system prompt string including the 72KB design guidelines.

The package SHALL have zero runtime dependencies (no `anthropic`, `openai`, or `httpx` required).

The package SHALL bundle the design guidelines as data files (markdown) and read them via `importlib.resources`.

#### Scenario: Python backend user gets Anthropic tools
- **WHEN** a Python developer calls `get_tools(format="anthropic")`
- **THEN** they receive a list of two dicts (`read_me` and `show_widget`) in Anthropic tool schema format
- **AND** the schemas are ready to pass directly to `client.messages.create(tools=tools)`

#### Scenario: Python backend user gets OpenAI tools
- **WHEN** a Python developer calls `get_tools(format="openai")`
- **THEN** they receive a list of two dicts in OpenAI function-calling format
- **AND** the schemas are ready to pass directly to `client.chat.completions.create(tools=tools)`

#### Scenario: System prompt includes guidelines
- **WHEN** a Python developer calls `get_system_prompt()`
- **THEN** the returned string includes instructions for using `read_me` and `show_widget` tools
- **AND** the string length is greater than 1000 characters (contains guideline content)

### Requirement: Guidelines Data Files
The Python package SHALL include design guidelines as separate markdown files under a `data/guidelines/` directory within the package.

The files SHALL include: `core.md`, `interactive.md`, `chart.md`, `diagram.md`, `mockup.md`, `art.md`.

The content SHALL match the guidelines embedded in the JS package's `guidelines.ts`.

#### Scenario: Guidelines loaded by module
- **WHEN** the system prompt is built and the LLM calls `read_me` with `modules: ["chart", "interactive"]`
- **THEN** the backend can load the corresponding guideline files and return their content to the LLM
