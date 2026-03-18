# Change: Add runtime theme switching for existing widgets

## Why
After the dark mode fix, widgets render correctly in whichever theme is active at creation time. But toggling the theme switch in the demo does not update already-rendered widgets — they stay in their original theme.

## What Changes
- `renderer.ts`: Add `setTheme()` method that re-generates and injects theme CSS into all existing widget Shadow DOMs
- `demo/main.ts`: Track active renderers, call `setTheme()` on theme toggle

## Impact
- Affected specs: `widget-theming` (modified)
- Affected code: `src/renderer.ts`, `demo/main.ts`
