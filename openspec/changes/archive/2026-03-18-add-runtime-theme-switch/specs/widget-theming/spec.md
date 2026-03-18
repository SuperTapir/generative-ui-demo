## MODIFIED Requirements

### Requirement: Theme-Consistent CSS Variables
The widget's CSS variables SHALL be provided exclusively through the `:host` selector in the Shadow DOM theme CSS, without duplicate declarations in SVG styles.

Form element focus styles SHALL use theme-appropriate shadow colors (light alpha for dark mode, dark alpha for light mode).

The renderer SHALL expose a `setTheme()` method that updates the theme CSS in all existing widget Shadow DOMs, enabling runtime theme switching without re-creating widgets.

#### Scenario: No duplicate CSS variable declarations
- **WHEN** the widget renderer builds theme CSS
- **THEN** CSS variables (`--color-text-primary`, `--color-background-primary`, etc.) are declared once on `:host`
- **AND** the SVG styles do not re-declare these variables via `:root`

#### Scenario: Runtime theme switch
- **WHEN** the consumer calls `renderer.setTheme("dark")` after widgets have been rendered in light mode
- **THEN** all existing widgets immediately update their backgrounds, text colors, SVG color ramps, and form element styles to dark mode
- **AND** no widget re-creation or re-rendering of content is required
