## Context

The generative-ui library was reverse-engineered from pi-generative-ui, which only runs in dark mode on macOS. The SVG styles were copied as-is — all color ramp hex values and CSS variable defaults target dark backgrounds. Now that the library supports light/dark/auto themes, the SVG styles need to adapt.

## Goals / Non-Goals

- Goals:
  - SVG color ramp classes (`c-blue`, `c-teal`, etc.) render correctly in both light and dark mode
  - CSS variables in widget scope come from one source (`:host` via `buildThemeCSS`)
  - Form element focus styles use theme-appropriate colors
- Non-Goals:
  - Changing the LLM guidelines content
  - Adding runtime theme switching for already-rendered widgets (out of scope)

## Decisions

### Convert SVG_STYLES from static export to a function

- **Decision:** `export function buildSvgStyles(theme: "light" | "dark"): string`
- **Rationale:** The color ramp values differ between light and dark mode (different hex stops). A function can return the correct set based on the resolved theme.
- **Alternative considered:** Using CSS custom properties for ramp values — rejected because SVG `fill`/`stroke` attributes use hardcoded hex in the guidelines, and the LLM generates `c-*` classes expecting specific fill behavior.

### Light mode color values from Guidelines

Per the color palette guidelines:
- **Light mode:** `50 fill + 600 stroke + 800 title / 600 subtitle`
- **Dark mode:** `800 fill + 200 stroke + 100 title / 200 subtitle`

### Remove `:root` variable block from SVG_STYLES

- **Decision:** Remove entirely — `buildThemeCSS()` already sets these on `:host` which correctly scopes within the Shadow DOM.
- **Rationale:** In Shadow DOM, `:root` targets the document root (not the shadow), so it either does nothing or leaks. The `:host` declaration in `buildThemeCSS()` is the correct location.

## Risks / Trade-offs

- **Minimal risk:** The color values come directly from the official Guidelines color palette table.
- **No migration needed:** This is purely a rendering fix; no API changes.
