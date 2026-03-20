# generative-ui (Python)

Platform-agnostic tool definitions and system prompt for LLM-powered visual widgets.

## Installation

```bash
pip install generative-ui
```

## Quick Start

```python
from generative_ui import get_tools, get_system_prompt, execute_read_me
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    system=get_system_prompt(),
    tools=get_tools(),
    messages=[{"role": "user", "content": "Draw a flowchart of a CI/CD pipeline"}],
)

# Handle tool calls
for block in response.content:
    if block.type == "tool_use" and block.name == "read_me":
        result = execute_read_me(block.input["modules"])
```

## API

### `get_tools(format="anthropic")`

Returns tool schemas. Supported formats: `"anthropic"`, `"openai"`, `"generic"`.

### `get_system_prompt(prefix=None)`

Returns the system prompt snippet. Optionally prepend project-specific instructions.

### `execute_read_me(modules)`

Execute the `read_me` tool call — returns design guidelines for the requested modules.

Valid modules: `interactive`, `chart`, `diagram`, `mockup`, `art`.
