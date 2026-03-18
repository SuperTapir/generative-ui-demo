# Change: Fix widget dark mode — make SVG styles and CSS variables theme-aware

## Why

`svg-styles.ts` hardcodes all CSS variables and SVG color ramp classes to **dark mode only** values (inherited from pi-generative-ui which only runs in dark mode on macOS). When the widget renderer is in light mode, the SVG color classes (`c-blue`, `c-teal`, etc.) still render with dark-mode hex values — dark fills on a light background look wrong.

Additionally, the `:root` block in `SVG_STYLES` re-declares CSS variables with hardcoded dark values, which can conflict with the theme-aware variables set by `buildThemeCSS()` on `:host`.

## What Changes

- **Convert `svg-styles.ts` from a static string to a function** that accepts the resolved theme ("light" | "dark") and returns the correct CSS
- **Add light mode color ramp values** following the Guidelines' "Light/dark mode quick pick" rule: `50 fill + 600 stroke + 800 title / 600 subtitle`
- **Remove the `:root` variable block** from `SVG_STYLES` — these variables are already provided by `buildThemeCSS()` on `:host`
- **Fix form element focus shadow** to use theme-appropriate alpha (currently hardcoded to `rgba(255,255,255,0.1)` even in light mode)

## Impact

- Affected specs: `widget-theming` (new)
- Affected code:
  - `src/svg-styles.ts` — convert to function, add light mode ramps, remove `:root`
  - `src/renderer.ts` — pass theme to `buildSvgStyles(theme)` instead of importing static `SVG_STYLES`
