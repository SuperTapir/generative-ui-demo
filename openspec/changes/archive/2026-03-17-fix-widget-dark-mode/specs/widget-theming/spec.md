## ADDED Requirements

### Requirement: Theme-Aware SVG Color Ramps
The SVG color ramp classes (`c-blue`, `c-teal`, `c-purple`, `c-coral`, `c-pink`, `c-gray`, `c-green`, `c-amber`, `c-red`) SHALL render with theme-appropriate color values based on the widget's resolved theme.

In light mode, ramps SHALL use: 50 (lightest) for fill, 600 for stroke, 800 for title text, 600 for subtitle text — per the design guidelines color palette.

In dark mode, ramps SHALL use: 800 for fill, 200 for stroke, 100 for title text, 200 for subtitle text — matching the existing behavior.

#### Scenario: SVG color ramps in light mode
- **WHEN** the widget renderer is configured with theme "light"
- **AND** the LLM generates SVG content using color ramp classes (e.g., `c-blue`)
- **THEN** shapes render with light-appropriate fills (e.g., Blue 50 `#E6F1FB`) and strokes (e.g., Blue 600 `#185FA5`)
- **AND** text inside colored groups uses dark stops for readability (e.g., Blue 800 `#0C447C` for titles)

#### Scenario: SVG color ramps in dark mode
- **WHEN** the widget renderer is configured with theme "dark"
- **AND** the LLM generates SVG content using color ramp classes
- **THEN** shapes render with dark-appropriate fills (e.g., Blue 800 `#0C447C`) and strokes (e.g., Blue 200 `#85B7EB`)
- **AND** text inside colored groups uses light stops for readability (e.g., Blue 100 `#B5D4F4` for titles)

### Requirement: Theme-Consistent CSS Variables
The widget's CSS variables SHALL be provided exclusively through the `:host` selector in the Shadow DOM theme CSS, without duplicate declarations in SVG styles.

Form element focus styles SHALL use theme-appropriate shadow colors (light alpha for dark mode, dark alpha for light mode).

#### Scenario: No duplicate CSS variable declarations
- **WHEN** the widget renderer builds theme CSS
- **THEN** CSS variables (`--color-text-primary`, `--color-background-primary`, etc.) are declared once on `:host`
- **AND** the SVG styles do not re-declare these variables via `:root`
