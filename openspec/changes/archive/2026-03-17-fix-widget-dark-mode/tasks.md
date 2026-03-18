## 1. SVG Styles Theme Support

- [x] 1.1 Refactor `src/svg-styles.ts`: convert `SVG_STYLES` constant to `buildSvgStyles(theme: "light" | "dark")` function
- [x] 1.2 Remove `:root` CSS variable block from SVG styles (already provided by `buildThemeCSS`)
- [x] 1.3 Add light mode color ramp values (50 fill, 600 stroke, 800 title, 600 subtitle per Guidelines)
- [x] 1.4 Add light mode neutral box/arrow/leader styles using theme variables
- [x] 1.5 Fix form element focus `box-shadow` to use theme-appropriate alpha

## 2. Renderer Integration

- [x] 2.1 Update `src/renderer.ts`: pass resolved theme to `buildSvgStyles()` instead of importing static `SVG_STYLES`
- [x] 2.2 Update import in renderer.ts

## 3. Validation

- [x] 3.1 Run `pnpm run build` and verify no type errors
