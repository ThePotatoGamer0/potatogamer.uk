import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeVibrant,
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

export function applyTheme(seed: string, mode: ThemeMode): void {
  const safeSeed = HEX.test(seed) ? seed : DEFAULT_SEED;
  const scheme = new SchemeVibrant(Hct.fromInt(argbFromHex(safeSeed)), mode === "dark", 0);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  for (const key of SCHEME_KEYS) {
    const value = scheme[key];
    if (typeof value !== "number") continue;
    root.style.setProperty(`--md-sys-color-${kebab(key)}`, hexFromArgb(value));
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", hexFromArgb(scheme.primary));
}

export function persistMode(mode: ThemeMode, avatarSeed?: string): void {
  const saved: ThemePreference = avatarSeed ? { mode, avatarSeed } : { mode };
  localStorage.setItem(THEME_KEY, JSON.stringify(saved));
}
