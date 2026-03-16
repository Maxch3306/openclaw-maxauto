// Theme color utilities — pure functions for HSL math and CSS variable derivation.

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  background: string;
  foreground: string;
  contrast: number;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default-dark", name: "settings.appearance.defaultDark", accent: "#4f8cff", background: "#1a1a2e", foreground: "#e0e0e0", contrast: 40 },
  { id: "default-light", name: "settings.appearance.defaultLight", accent: "#2563eb", background: "#ffffff", foreground: "#1a1a1a", contrast: 35 },
  { id: "ocean", name: "settings.appearance.ocean", accent: "#06b6d4", background: "#0f172a", foreground: "#e2e8f0", contrast: 45 },
  { id: "rosewood", name: "settings.appearance.rosewood", accent: "#f43f5e", background: "#1c1917", foreground: "#e7e5e4", contrast: 40 },
  { id: "monochrome", name: "settings.appearance.monochrome", accent: "#ffffff", background: "#111111", foreground: "#d4d4d4", contrast: 50 },
];

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Format HSL as shadcn CSS value: "217 100% 65%" */
export function hslToCssValue(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Derive all shadcn CSS variables from 4 inputs.
 * Returns a Record<string, string> where keys are CSS var names (without --)
 * and values are HSL strings like "217 100% 65%".
 */
export function deriveThemeVariables(
  accent: string,
  background: string,
  foreground: string,
  contrast: number,
): Record<string, string> {
  const bg = hexToHsl(background);
  const fg = hexToHsl(foreground);
  const ac = hexToHsl(accent);
  const isDark = bg.l < 50;
  const cFactor = contrast / 100;

  // Card/popover: slightly offset from background
  const cardL = clamp(isDark ? bg.l + 3 : bg.l - 3, 0, 100);

  // Secondary: accent-tinted background
  const secondaryL = clamp(isDark ? bg.l + 6 : bg.l - 6, 0, 100);
  const secondaryS = clamp(Math.min(bg.s + 10, 50), 0, 100);

  // Border: lerp between bg and fg based on contrast
  const borderL = lerp(bg.l, fg.l, cFactor * 0.35);

  // Muted foreground: fg shifted toward bg
  const mutedFgL = lerp(fg.l, bg.l, 0.35);

  // Primary foreground: white on dark accent, black on light accent
  const primaryFgL = ac.l > 55 ? 10 : 100;

  const v = hslToCssValue;

  return {
    background: v(bg.h, bg.s, bg.l),
    foreground: v(fg.h, fg.s, fg.l),
    card: v(bg.h, bg.s, cardL),
    "card-foreground": v(fg.h, fg.s, fg.l),
    popover: v(bg.h, bg.s, cardL),
    "popover-foreground": v(fg.h, fg.s, fg.l),
    primary: v(ac.h, ac.s, ac.l),
    "primary-foreground": v(0, 0, primaryFgL),
    secondary: v(ac.h, secondaryS, secondaryL),
    "secondary-foreground": v(fg.h, fg.s, fg.l),
    muted: v(bg.h, bg.s, cardL),
    "muted-foreground": v(fg.h, Math.max(fg.s - 10, 0), mutedFgL),
    accent: v(ac.h, secondaryS, secondaryL),
    "accent-foreground": v(fg.h, fg.s, fg.l),
    destructive: "4 90% 58%",
    "destructive-foreground": "0 0% 100%",
    border: v(bg.h, clamp(bg.s + 5, 0, 100), borderL),
    input: v(bg.h, clamp(bg.s + 5, 0, 100), borderL),
    ring: v(ac.h, ac.s, ac.l),
    success: "122 39% 49%",
    "success-foreground": "0 0% 100%",
    warning: "36 100% 50%",
    "warning-foreground": "0 0% 100%",
  };
}

/** Apply a variable map to document root as inline styles. */
export function applyThemeVariables(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(`--${key}`, value);
  }
}

/** Remove all inline theme overrides so CSS defaults apply. */
export function clearThemeVariables(): void {
  const root = document.documentElement;
  const vars = [
    "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
    "primary", "primary-foreground", "secondary", "secondary-foreground",
    "muted", "muted-foreground", "accent", "accent-foreground",
    "destructive", "destructive-foreground", "border", "input", "ring",
    "success", "success-foreground", "warning", "warning-foreground",
  ];
  for (const v of vars) {
    root.style.removeProperty(`--${v}`);
  }
}
