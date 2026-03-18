# widget-loading Specification

## Purpose
TBD - created by archiving change improve-demo-ux. Update Purpose after archive.
## Requirements
### Requirement: Widget Loading Overlay
The renderer SHALL display a loading overlay inside the widget container immediately when a widget is created, before any HTML content arrives from the LLM stream.

The overlay SHALL display animated loading dots and cycle through `loading_messages` provided by the LLM via the `show_widget` tool parameters. If no `loading_messages` are provided, the overlay SHALL display a default message (e.g., "Rendering widget...").

The overlay SHALL be dismissed with a fade-out transition when the first meaningful HTML content is rendered via `widget.update()`.

#### Scenario: Loading overlay with LLM-provided messages
- **WHEN** a `show_widget` tool call starts and the LLM provides `loading_messages: ["Crunching numbers...", "Building chart..."]`
- **THEN** the widget container displays a loading overlay that cycles through "Crunching numbers..." and "Building chart..."
- **AND** when the first HTML content chunk arrives and is rendered, the overlay fades out and the widget content is visible

#### Scenario: Loading overlay with default message
- **WHEN** a `show_widget` tool call starts and no `loading_messages` are provided
- **THEN** the widget container displays a loading overlay with a default message
- **AND** the overlay is dismissed when content arrives

#### Scenario: Direct widget render
- **WHEN** `renderWidget()` is called with complete widget data (not streaming)
- **THEN** the loading overlay is shown briefly and dismissed after the content is rendered

### Requirement: Streaming Handler Loading Message Extraction
The streaming handler SHALL extract `loading_messages` and `title` from partial arguments during early `tool_call_delta` events and pass them to the renderer when creating widget containers.

#### Scenario: Early extraction of loading messages
- **WHEN** the LLM streams a `show_widget` tool call and emits `title` and `loading_messages` before `widget_code`
- **THEN** the streaming handler extracts these values from partial args and uses them when creating the widget container

