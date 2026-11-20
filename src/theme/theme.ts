import {
  argbFromHex,
  DynamicScheme,
  Hct,
  hexFromArgb,
  TonalPalette,
} from "@material/material-color-utilities";
import { DEFAULT_SEED } from "../../shared/site";

export type ThemeMode = "light" | "dark";

export interface ThemePreference {
  mode: ThemeMode;
  avatarSeed?: string;
}

export const THEME_KEY = "pg-theme";

const SCHEME_KEYS = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "shadow",
  "scrim",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
] as const;

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function seedFor(preference: ThemePreference): string {
  return preference.avatarSeed && HEX.test(preference.avatarSeed) ? preference.avatarSeed : DEFAULT_SEED;
}

export function readThemePreference(): ThemePreference {
  const fallbackMode: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const fallback: ThemePreference = { mode: fallbackMode };
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThemePreference>;
    const mode = parsed.mode === "light" || parsed.mode === "dark" ? parsed.mode : fallback.mode;
    const avatarSeed = typeof parsed.avatarSeed === "string" && HEX.test(parsed.avatarSeed) ? parsed.avatarSeed : undefined;
    return { mode, avatarSeed };
  } catch {
    return fallback;
  }
}

const SURFACE_KEYS = new Set<string>([
  "background",
  "surface",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "surfaceVariant",
]);

export function applyTheme(seed: string, mode: ThemeMode): void {
  const safeSeed = HEX.test(seed) ? seed : DEFAULT_SEED;
  const source = Hct.fromInt(argbFromHex(safeSeed));
  const scheme = schemeFor(source, mode);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  for (const key of SCHEME_KEYS) {
    const value = scheme[key];
    if (typeof value !== "number") continue;
    const color = SURFACE_KEYS.has(key) ? paintedSurface(value, source, mode) : value;
    root.style.setProperty(`--md-sys-color-${kebab(key)}`, hexFromArgb(color));
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", hexFromArgb(scheme.primary));
}

function schemeFor(source: Hct, mode: ThemeMode): DynamicScheme {
  const hue = source.hue;
  const options: ConstructorParameters<typeof DynamicScheme>[0] = {
    sourceColorArgb: source.toInt(),
    variant: 3 as ConstructorParameters<typeof DynamicScheme>[0]["variant"],
    contrastLevel: 0,
    isDark: mode === "dark",
    primaryPalette: TonalPalette.fromHueAndChroma(hue, 200),
    secondaryPalette: TonalPalette.fromHueAndChroma(hue, 36),
    tertiaryPalette: TonalPalette.fromHueAndChroma((hue + 14) % 360, 52),
    neutralPalette: TonalPalette.fromHueAndChroma(hue, 8),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(hue, 10),
  };
  return new DynamicScheme(options);
}

/** Light pastel seeds keep their own tone. Saturated seeds stay on the usual light paper. */
function paintedSurface(argb: number, seed: Hct, mode: ThemeMode): number {
  const current = Hct.fromInt(argb);
  if (mode === "dark") return Hct.from(seed.hue, 24, current.tone).toInt();
  const pastel = seed.tone >= 78 && seed.chroma <= 36;
  const shift = pastel ? Math.min(0, Math.max(-8, seed.tone - 96)) : 0;
  const chroma = pastel ? Math.min(18, Math.max(12, seed.chroma)) : Math.max(current.chroma, 8);
  return Hct.from(seed.hue, chroma, Math.max(78, current.tone + shift)).toInt();
}

export function persistMode(mode: ThemeMode, avatarSeed?: string): void {
  const saved: ThemePreference = avatarSeed ? { mode, avatarSeed } : { mode };
  localStorage.setItem(THEME_KEY, JSON.stringify(saved));
}
