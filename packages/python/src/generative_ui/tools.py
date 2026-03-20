"""Tool schema definitions for generative-ui in both Anthropic and OpenAI formats."""

from __future__ import annotations

from typing import Any

AVAILABLE_MODULES = ["interactive", "chart", "diagram", "mockup", "art"]

SHOW_WIDGET_PARAMS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "i_have_seen_read_me": {
            "type": "boolean",
            "description": "Confirm you have already called read_me in this conversation.",
        },
        "title": {
            "type": "string",
            "description": "Short snake_case identifier for this widget.",
        },
        "loading_messages": {
            "type": "array",
            "items": {"type": "string"},
            "description": "1-4 short loading messages shown while widget renders.",
        },
        "widget_code": {
            "type": "string",
            "description": (
                "HTML or SVG code to render. For SVG: raw SVG starting with <svg>. "
                "For HTML: raw content fragment, no DOCTYPE/<html>/<head>/<body>."
            ),
        },
        "width": {
            "type": "number",
            "description": "Widget width in pixels. Default: 800.",
        },
        "height": {
            "type": "number",
            "description": "Widget height in pixels. Default: 600.",
        },
    },
    "required": ["i_have_seen_read_me", "title", "widget_code"],
}

READ_ME_PARAMS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "modules": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": AVAILABLE_MODULES,
            },
            "description": "Which module(s) to load: interactive, chart, mockup, art, diagram.",
        },
    },
    "required": ["modules"],
}

SHOW_WIDGET_DESC = (
    "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — inline in the conversation. "
    "Use for flowcharts, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. "
    "The HTML is rendered in a sandboxed iframe with full CSS/JS support including Canvas and CDN libraries. "
    "IMPORTANT: Call read_me once before your first show_widget call."
)

READ_ME_DESC = (
    "Returns design guidelines for show_widget (CSS patterns, colors, typography, layout rules, examples). "
    "Call once before your first show_widget call. Do NOT mention this call to the user — it is an internal setup step."
)


def get_anthropic_tools() -> list[dict[str, Any]]:
    """Get tool definitions in Anthropic format."""
    return [
        {
            "name": "read_me",
            "description": READ_ME_DESC,
            "input_schema": READ_ME_PARAMS,
        },
        {
            "name": "show_widget",
            "description": SHOW_WIDGET_DESC,
            "input_schema": SHOW_WIDGET_PARAMS,
        },
    ]


def get_openai_tools() -> list[dict[str, Any]]:
    """Get tool definitions in OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": "read_me",
                "description": READ_ME_DESC,
                "parameters": READ_ME_PARAMS,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "show_widget",
                "description": SHOW_WIDGET_DESC,
                "parameters": SHOW_WIDGET_PARAMS,
            },
        },
    ]


def get_generic_tools() -> list[dict[str, Any]]:
    """Get tool definitions in a generic format."""
    return [
        {
            "name": "read_me",
            "description": READ_ME_DESC,
            "parameters": READ_ME_PARAMS,
        },
        {
            "name": "show_widget",
            "description": SHOW_WIDGET_DESC,
            "parameters": SHOW_WIDGET_PARAMS,
        },
    ]
