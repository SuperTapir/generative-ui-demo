"""Guidelines loader for generative-ui design system.

Reads markdown guideline files packaged with the library and assembles
them based on requested modules.
"""

from __future__ import annotations

import importlib.resources
from typing import Sequence

AVAILABLE_MODULES = ["interactive", "chart", "diagram", "mockup", "art"]


def _read_guideline(filename: str) -> str:
    """Read a guideline markdown file from the data/guidelines directory."""
    ref = importlib.resources.files("generative_ui") / "data" / "guidelines" / filename
    return ref.read_text(encoding="utf-8")


def get_guidelines(modules: Sequence[str]) -> str:
    """Return design guidelines for the requested modules.

    Always includes the core guidelines, then appends module-specific
    guidelines for each requested module.

    Args:
        modules: List of module names to load. Valid values:
                 "interactive", "chart", "diagram", "mockup", "art".

    Returns:
        Combined guideline text as a string.
    """
    content = _read_guideline("core.md")
    seen: set[str] = set()

    # Module-to-file mapping (mirrors the JS SDK's MODULE_SECTIONS)
    module_files: dict[str, list[str]] = {
        "art": ["art.md"],
        "mockup": ["mockup.md"],
        "interactive": ["interactive.md"],
        "chart": ["chart.md"],
        "diagram": ["diagram.md"],
    }

    for mod in modules:
        files = module_files.get(mod)
        if not files:
            continue
        for f in files:
            if f not in seen:
                seen.add(f)
                content += "\n\n\n" + _read_guideline(f)

    return content + "\n"


def execute_read_me(modules: Sequence[str]) -> str:
    """Execute the read_me tool — returns design guidelines for the requested modules.

    This is the function to call when handling a ``read_me`` tool call
    from the LLM.
    """
    return get_guidelines(modules)
