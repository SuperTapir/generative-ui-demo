"""Generative UI — tool definitions and system prompt for LLM-powered visual widgets.

This package provides everything a Python backend needs to integrate
generative-ui tools into LLM conversations:

- ``get_tools()`` — tool schemas in Anthropic or OpenAI format
- ``get_system_prompt()`` — system prompt instructing the LLM how to use the tools
- ``execute_read_me()`` — handle the ``read_me`` tool call (returns design guidelines)

Example usage with the Anthropic SDK::

    from generative_ui import get_tools, get_system_prompt, execute_read_me
    import anthropic

    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-sonnet-4-6",
        system=get_system_prompt(),
        tools=get_tools(),
        messages=[{"role": "user", "content": "Draw a flowchart of a CI/CD pipeline"}],
    )
"""

from __future__ import annotations

from typing import Any, Literal, Sequence

from .guidelines import execute_read_me, get_guidelines, AVAILABLE_MODULES
from .prompt import get_system_prompt
from .tools import get_anthropic_tools, get_openai_tools, get_generic_tools

__all__ = [
    "get_tools",
    "get_system_prompt",
    "get_guidelines",
    "execute_read_me",
    "get_anthropic_tools",
    "get_openai_tools",
    "get_generic_tools",
    "AVAILABLE_MODULES",
]


def get_tools(
    format: Literal["anthropic", "openai", "generic"] = "anthropic",
) -> list[dict[str, Any]]:
    """Get tool definitions in the specified format.

    Args:
        format: The tool schema format to return.
                - ``"anthropic"`` (default) — Anthropic Messages API format
                - ``"openai"`` — OpenAI function-calling format
                - ``"generic"`` — Simple name/description/parameters format

    Returns:
        List of tool schema dictionaries.
    """
    if format == "openai":
        return get_openai_tools()
    if format == "generic":
        return get_generic_tools()
    return get_anthropic_tools()
