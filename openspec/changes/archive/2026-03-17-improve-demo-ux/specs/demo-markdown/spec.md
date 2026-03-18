## ADDED Requirements

### Requirement: Demo Chat Markdown Rendering
The demo chat SHALL render LLM assistant text responses as formatted Markdown (HTML) instead of plain text.

The rendering SHALL support at minimum: headings, bold/italic, lists (ordered and unordered), code blocks (inline and fenced), links, tables, and blockquotes.

The rendered HTML SHALL be sanitized to prevent XSS attacks.

#### Scenario: Markdown text rendering
- **WHEN** the LLM returns a text response containing Markdown syntax (e.g., `**bold**`, `# Heading`, `` `code` ``, `- list item`)
- **THEN** the demo chat renders the text as formatted HTML with proper styling

#### Scenario: Streaming Markdown updates
- **WHEN** the LLM streams text token by token
- **THEN** the demo chat re-renders the accumulated Markdown on each update without losing scroll position

#### Scenario: XSS prevention
- **WHEN** the LLM returns text containing HTML script tags or event handlers
- **THEN** the rendered output is sanitized and no scripts execute
