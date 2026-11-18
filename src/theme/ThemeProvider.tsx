import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultConfig, type SiteColor } from "../../shared/site";
import { sampleAvatarSeed } from "./sampleAvatar";
import { applyTheme, persistMode, readThemePreference, type ThemeMode } from "./theme";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  registerAvatar: (url: string | null) => void;
  setSiteColor: (color: SiteColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const seedCache = new Map<string, string>();

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readThemePreference().mode);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSeed, setAvatarSeed] = useState<string | undefined>(() => readThemePreference().avatarSeed);
  const [siteColor, setSiteColorState] = useState<SiteColor>(defaultConfig.color);
  const manual = siteColor.source === "manual";
  const activeSeed = manual ? siteColor.seed : (avatarSeed ?? siteColor.seed);

  useEffect(() => {
    applyTheme(activeSeed, mode);
  }, [activeSeed, mode]);

  useEffect(() => {
    persistMode(mode, avatarSeed);
  }, [avatarSeed, mode]);

  useEffect(() => {
    if (manual || !avatarUrl) return;
    const cached = seedCache.get(avatarUrl);
    if (cached) {
      setAvatarSeed((current) => (current === cached ? current : cached));
      return;
    }

    let cancelled = false;
    sampleAvatarSeed(avatarUrl)
      .then((seed) => {
        if (!seed || cancelled) return;
        seedCache.set(avatarUrl, seed);
        setAvatarSeed((current) => (current === seed ? current : seed));
      })
      .catch(() => {
        /* Keep the previous seed if the avatar can't be sampled. */
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, manual]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const registerAvatar = useCallback((url: string | null) => {
    setAvatarUrl((current) => (current === url ? current : url));
  }, []);

  const setSiteColor = useCallback((color: SiteColor) => {
    setSiteColorState((current) => (current.source === color.source && current.seed === color.seed ? current : color));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, registerAvatar, setSiteColor }),
    [mode, registerAvatar, setMode, setSiteColor],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
