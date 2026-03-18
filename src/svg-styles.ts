// Theme-aware CSS classes for SVG diagrams and form elements.
// Reverse-engineered from the claude.ai artifact rendering system based on the
// design guidelines extracted in guidelines.ts. These classes are what the
// guidelines mean by "already loaded in SVG widget".
//
// Color ramp values follow the Guidelines' "Light/dark mode quick pick" rule:
//   Light mode: 50 fill + 600 stroke + 800 title / 600 subtitle
//   Dark mode:  800 fill + 200 stroke + 100 title / 200 subtitle

interface ColorRamp {
  name: string;
  /** [fill, stroke, title, subtitle] */
  light: [string, string, string, string];
  dark: [string, string, string, string];
}

// Values from the design guidelines color palette table
const COLOR_RAMPS: ColorRamp[] = [
  { name: "purple", light: ["#EEEDFE", "#534AB7", "#3C3489", "#534AB7"], dark: ["#3C3489", "#AFA9EC", "#CECBF6", "#AFA9EC"] },
  { name: "teal",   light: ["#E1F5EE", "#0F6E56", "#085041", "#0F6E56"], dark: ["#085041", "#5DCAA5", "#9FE1CB", "#5DCAA5"] },
  { name: "coral",  light: ["#FAECE7", "#993C1D", "#712B13", "#993C1D"], dark: ["#712B13", "#F0997B", "#F5C4B3", "#F0997B"] },
  { name: "pink",   light: ["#FBEAF0", "#993556", "#72243E", "#993556"], dark: ["#72243E", "#ED93B1", "#F4C0D1", "#ED93B1"] },
  { name: "gray",   light: ["#F1EFE8", "#5F5E5A", "#444441", "#5F5E5A"], dark: ["#444441", "#B4B2A9", "#D3D1C7", "#B4B2A9"] },
  { name: "blue",   light: ["#E6F1FB", "#185FA5", "#0C447C", "#185FA5"], dark: ["#0C447C", "#85B7EB", "#B5D4F4", "#85B7EB"] },
  { name: "green",  light: ["#EAF3DE", "#3B6D11", "#27500A", "#3B6D11"], dark: ["#27500A", "#97C459", "#C0DD97", "#97C459"] },
  { name: "amber",  light: ["#FAEEDA", "#854F0B", "#633806", "#854F0B"], dark: ["#633806", "#EF9F27", "#FAC775", "#EF9F27"] },
  { name: "red",    light: ["#FCEBEB", "#A32D2D", "#791F1F", "#A32D2D"], dark: ["#791F1F", "#F09595", "#F7C1C1", "#F09595"] },
];

function buildColorRampCSS(theme: "light" | "dark"): string {
  return COLOR_RAMPS.map(({ name, light, dark }) => {
    const [fill, stroke, title, subtitle] = theme === "light" ? light : dark;
    const sel = `c-${name}`;
    return `
/* ${name} */
svg .${sel} > rect, svg .${sel} > circle, svg .${sel} > ellipse { fill: ${fill}; stroke: ${stroke}; }
svg .${sel} > .th, svg .${sel} > .t { fill: ${title}; }
svg .${sel} > .ts { fill: ${subtitle}; }
svg rect.${sel}, svg circle.${sel}, svg ellipse.${sel} { fill: ${fill}; stroke: ${stroke}; }`;
  }).join("\n");
}

/**
 * Build theme-aware SVG styles.
 *
 * CSS variables (--color-text-primary, etc.) are NOT included here —
 * they are provided by buildThemeCSS() on :host in the Shadow DOM.
 * This function only emits SVG helper classes and form element styles
 * that reference those variables.
 */
export function buildSvgStyles(theme: "light" | "dark"): string {
  const focusShadow = theme === "light"
    ? "rgba(0,0,0,0.1)"
    : "rgba(255,255,255,0.1)";

  return `
/* Text classes */
svg .t  { font-family: var(--font-sans); font-size: 14px; fill: var(--p); }
svg .ts { font-family: var(--font-sans); font-size: 12px; fill: var(--s); }
svg .th { font-family: var(--font-sans); font-size: 14px; font-weight: 500; fill: var(--p); }

/* Neutral box */
svg .box { fill: var(--bg2); stroke: var(--b); }

/* Clickable node */
svg .node { cursor: pointer; }
svg .node:hover { opacity: 0.8; }

/* Arrow connector */
svg .arr { stroke: var(--t); stroke-width: 1.5; fill: none; }

/* Leader line */
svg .leader { stroke: var(--t); stroke-width: 0.5; stroke-dasharray: 4 3; fill: none; }

/* ── Color ramp classes ──────────────────────────────────────────────────
   Light mode: 50 fill, 600 stroke, 800 title (.th/.t), 600 subtitle (.ts)
   Dark mode:  800 fill, 200 stroke, 100 title (.th/.t), 200 subtitle (.ts) */
${buildColorRampCSS(theme)}

/* Pre-styled form elements */
button {
  background: transparent;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  padding: 6px 14px;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-sans);
}
button:hover { background: var(--color-background-secondary); }
button:active { transform: scale(0.98); }

input[type="range"] {
  -webkit-appearance: none;
  height: 4px;
  background: var(--color-border-secondary);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-primary);
  cursor: pointer;
}

input[type="text"], input[type="number"], textarea, select {
  height: 36px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  padding: 0 10px;
  font-size: 14px;
  font-family: var(--font-sans);
  outline: none;
}
input[type="text"]:hover, input[type="number"]:hover, textarea:hover, select:hover {
  border-color: var(--color-border-secondary);
}
input[type="text"]:focus, input[type="number"]:focus, textarea:focus, select:focus {
  border-color: var(--color-border-primary);
  box-shadow: 0 0 0 2px ${focusShadow};
}
`;
}
