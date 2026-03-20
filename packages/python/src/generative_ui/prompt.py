"""System prompt builder for generative-ui."""

from __future__ import annotations

SYSTEM_PROMPT_SNIPPET = """\
You have access to two visual tools for creating interactive widgets:

1. **read_me** — Load design guidelines before creating widgets. Call silently before first show_widget use. Pick the modules that match your use case: interactive, chart, mockup, art, diagram.

2. **show_widget** — Render interactive HTML/SVG widgets inline. Supports full CSS, JS, Canvas, and CDN libraries (cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh).

Rules:
- Call read_me once before your first show_widget call to load design guidelines.
- Do NOT mention the read_me call to the user — call it silently, then proceed directly to building the widget.
- Structure HTML as fragments: no DOCTYPE/<html>/<head>/<body>. Style first, then HTML, then scripts.
- For SVG: start code with <svg> tag, it will be auto-detected.
- Use show_widget when the user asks for visual content: charts, diagrams, interactive explainers, UI mockups, art.
- Keep widgets focused. Default size is 800x600 but adjust to fit content.
- For interactive explainers: use sliders, live calculations, Chart.js charts.
- CRITICAL: widget_code MUST always contain complete, runnable HTML or SVG code. Never call show_widget with an empty or placeholder widget_code — always write the full implementation in a single call."""


def get_system_prompt(prefix: str | None = None) -> str:
    """Build the system prompt, optionally prepending user-provided text.

    Args:
        prefix: Optional text prepended to the built-in system prompt.
                Use this to add project-specific instructions.

    Returns:
        The full system prompt string.
    """
    if prefix:
        return f"{prefix}\n\n{SYSTEM_PROMPT_SNIPPET}"
    return SYSTEM_PROMPT_SNIPPET
