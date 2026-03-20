"""Demo FastAPI backend for generative-ui.

Shows the "bring your own backend" pattern:
- Uses generative-ui Python SDK for tool schemas and system prompt
- Calls Anthropic HTTP API directly with httpx (no SDK, zero buffering)
- Streams SSE responses to the frontend
- Handles tool call loops (read_me → continue) server-side
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from generative_ui import get_tools, get_system_prompt, execute_read_me

app = FastAPI(title="Generative UI Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
BASE_URL = (os.getenv("ANTHROPIC_BASE_URL", "") or "https://api.anthropic.com").rstrip(
    "/"
)
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 16384
MAX_TOOL_ROUNDS = 5

# Reuse a single async httpx client for connection pooling
_http_client: httpx.AsyncClient | None = None


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10, read=300, write=10, pool=10))
    return _http_client


async def _stream_anthropic_sse(
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
):
    """Call Anthropic Messages API with stream=true, yield raw SSE lines.

    Each line from the upstream API is forwarded immediately — no parsing,
    no buffering, no SDK overhead.
    """
    client = await _get_http_client()

    body = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": messages,
        "tools": tools,
        "stream": True,
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }

    async with client.stream(
        "POST",
        f"{BASE_URL}/v1/messages",
        json=body,
        headers=headers,
    ) as response:
        if response.status_code != 200:
            error_body = await response.aread()
            raise httpx.HTTPStatusError(
                f"Anthropic API error {response.status_code}: {error_body.decode()}",
                request=response.request,
                response=response,
            )

        # Yield raw SSE lines byte-by-byte as they arrive from upstream.
        # httpx.stream + aiter_lines gives us true streaming with no buffering.
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                yield line + "\n\n"


def _execute_tool(name: str, input_data: dict[str, Any]) -> str:
    """Execute a single tool call and return the result string."""
    if name == "read_me":
        modules = input_data.get("modules", [])
        return execute_read_me(modules)
    elif name == "show_widget":
        code = input_data.get("widget_code", "")
        if not code or not code.strip():
            return (
                "ERROR: widget_code was empty or missing. "
                "Please call show_widget again with complete widget code."
            )
        return "Widget rendered successfully."
    return "Unknown tool."


def _parse_sse_events(raw_lines: list[str]) -> list[dict[str, Any]]:
    """Parse collected SSE data lines into event dicts."""
    events = []
    for line in raw_lines:
        data = line.removeprefix("data: ").strip()
        if not data or data == "[DONE]":
            continue
        try:
            events.append(json.loads(data))
        except json.JSONDecodeError:
            continue
    return events


def _reconstruct_content(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reconstruct content blocks from a sequence of SSE events."""
    content: list[dict[str, Any]] = []
    current_block: dict[str, Any] | None = None

    for ev in events:
        t = ev.get("type", "")

        if t == "content_block_start":
            block = ev.get("content_block", {})
            btype = block.get("type", "")
            if btype == "tool_use":
                current_block = {
                    "type": "tool_use",
                    "id": block.get("id", ""),
                    "name": block.get("name", ""),
                    "input_json": "",
                }
            elif btype == "text":
                current_block = {"type": "text", "text": ""}
            else:
                current_block = None

        elif t == "content_block_delta" and current_block is not None:
            delta = ev.get("delta", {})
            dtype = delta.get("type", "")
            if dtype == "text_delta" and current_block["type"] == "text":
                current_block["text"] += delta.get("text", "")
            elif dtype == "input_json_delta" and current_block["type"] == "tool_use":
                current_block["input_json"] += delta.get("partial_json", "")

        elif t == "content_block_stop" and current_block is not None:
            if current_block["type"] == "tool_use":
                try:
                    parsed_input = json.loads(current_block["input_json"] or "{}")
                except json.JSONDecodeError:
                    parsed_input = {}
                content.append(
                    {
                        "type": "tool_use",
                        "id": current_block["id"],
                        "name": current_block["name"],
                        "input": parsed_input,
                    }
                )
            elif current_block["type"] == "text":
                content.append(
                    {"type": "text", "text": current_block["text"]}
                )
            current_block = None

    return content


async def stream_response(messages: list[dict[str, Any]]):
    """Stream Anthropic API response as SSE, handling tool call loops."""
    tools = get_tools()
    system = get_system_prompt()

    for _round in range(MAX_TOOL_ROUNDS):
        collected_lines: list[str] = []

        async for sse_line in _stream_anthropic_sse(system, messages, tools):
            # Forward to client immediately
            yield sse_line
            # Also collect for tool-call detection
            collected_lines.append(sse_line.strip())

        # Parse events to check for tool calls
        events = _parse_sse_events(collected_lines)
        content = _reconstruct_content(events)
        tool_calls = [b for b in content if b["type"] == "tool_use"]

        if not tool_calls:
            break

        # Append assistant message to conversation
        messages.append({"role": "assistant", "content": content})

        # Execute tools and append results
        tool_results = []
        for tc in tool_calls:
            result = _execute_tool(tc["name"], tc["input"])
            tool_results.append(
                {"type": "tool_result", "tool_use_id": tc["id"], "content": result}
            )
        messages.append({"role": "user", "content": tool_results})

    yield "data: [DONE]\n\n"


@app.post("/api/chat")
async def chat(request: Request):
    """Accept messages and stream an Anthropic response as SSE."""
    body = await request.json()
    messages = body.get("messages", [])

    return StreamingResponse(
        stream_response(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/config")
async def config():
    """Return current configuration (for frontend display)."""
    return {
        "provider": "anthropic",
        "model": MODEL,
        "base_url": BASE_URL,
    }
