import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cardFromPath } from "../../shared/og";
import { defaultConfig, OWNER_DISCORD_ID, type SiteConfig, type StorageMode } from "../../shared/site";
import { useLanyard, type LanyardState } from "../hooks/useLanyard";
import { api } from "../lib/api";
import { avatarUrl, botStatuses, kvString, type BotStatus } from "../lib/discord";
import { withSpeechMarks } from "../lib/format";
import type { DiscordUser } from "../lib/lanyard";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

interface ConfigResponse {
  config: SiteConfig;
  storage: StorageMode;
}

interface ConfigContextValue {
  config: SiteConfig;
  setConfig: (config: SiteConfig) => void;
  storage: StorageMode | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

interface DiscordDirectory {
  configured: boolean;
  users: Record<string, DiscordUser | null>;
  statuses: Record<string, BotStatus>;
}

const EMPTY_DIRECTORY: DiscordDirectory = { configured: false, users: {}, statuses: {} };

const ConfigContext = createContext<ConfigContextValue | null>(null);
const LanyardContext = createContext<LanyardState | null>(null);
const DiscordContext = createContext<DiscordDirectory>(EMPTY_DIRECTORY);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <ThemeProvider>
        <SiteColorBridge />
        <LanyardBridge>{children}</LanyardBridge>
      </ThemeProvider>
    </ConfigProvider>
  );
}

function SiteColorBridge() {
  const { config } = useConfig();
  const { setSiteColor } = useTheme();

  useEffect(() => {
    setSiteColor(config.color);
  }, [config.color, setSiteColor]);

  return null;
}

function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [storage, setStorage] = useState<StorageMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await api<ConfigResponse>("/api/config");
    setConfig(data.config);
    setStorage(data.storage);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<ConfigResponse>("/api/config")
      .then((data) => {
        if (cancelled) return;
        setConfig(data.config);
        setStorage(data.storage);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load site config.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ config, setConfig, storage, loading, error, reload }),
    [config, error, loading, reload, storage],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

function LanyardBridge({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const ids = useMemo(() => {
    const unique = new Set<string>([OWNER_DISCORD_ID]);
    for (const friend of config.friends) {
      if (/^\d{17,20}$/.test(friend.discordId)) unique.add(friend.discordId);
    }
    return [...unique];
  }, [config.friends]);
  const lanyard = useLanyard(ids);
  const { pathname } = useLocation();
  const quote = withSpeechMarks(kvString(lanyard.owner?.kv, "quote").replace(/\s+/g, " "));
  useEffect(() => {
    if (cardFromPath(pathname)) return;
    document.title = quote ? `${quote} - ThePotatoGamer` : "ThePotatoGamer";
  }, [pathname, quote]);

  return (
    <LanyardContext.Provider value={lanyard}>
      <DiscordBridge>{children}</DiscordBridge>
    </LanyardContext.Provider>
  );
}

function DiscordBridge({ children }: { children: ReactNode }) {
  const { registerAvatar } = useTheme();
  const { owner, ready, missing } = usePresence();
  const [profiles, setProfiles] = useState<DiscordDirectory>(EMPTY_DIRECTORY);
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!ready || !missingKey) {
      setProfiles((current) => (Object.keys(current.users).length === 0 && Object.keys(current.statuses).length === 0 ? current : { ...current, users: {}, statuses: {} }));
      return;
    }
    const controller = new AbortController();
    const profileParams = new URLSearchParams({ ids: missingKey });
    api<DiscordDirectory>(`/api/discord?${profileParams}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setProfiles((current) => ({ ...current, configured: data.configured, users: data.users }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setProfiles((current) => ({ ...current, configured: false, users: {} }));
      });

    let canceled = false;
    const loadStatuses = () => {
      const params = new URLSearchParams({ part: "statuses", ids: missingKey });
      api<{ statuses?: unknown }>(`/api/discord?${params}`, { signal: controller.signal })
        .then((data) => {
          if (canceled || controller.signal.aborted) return;
          setProfiles((current) => ({ ...current, statuses: botStatuses(data.statuses) }));
        })
        .catch(() => {
          // Keep the last statuses. A failed refresh should not wipe a status CatTag already returned.
        });
    };
    loadStatuses();
    const timer = window.setInterval(loadStatuses, 60_000);
    return () => {
      canceled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [missingKey, ready]);

  const ownerUser = owner?.discord_user ?? profiles.users[OWNER_DISCORD_ID] ?? null;
  const ownerAvatar = ownerUser ? avatarUrl(ownerUser, 128) : null;

  useEffect(() => {
    registerAvatar(ownerAvatar);
  }, [ownerAvatar, registerAvatar]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("#favicon");
    if (!link || !ownerUser?.avatar) return;
    link.href = `https://cdn.discordapp.com/avatars/${ownerUser.id}/${ownerUser.avatar}.png?size=128`;
    link.type = "image/png";
  }, [ownerUser]);

  return <DiscordContext.Provider value={profiles}>{children}</DiscordContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useConfig must be used inside AppProviders");
  return value;
}

export function usePresence(): LanyardState {
  const value = useContext(LanyardContext);
  if (!value) throw new Error("usePresence must be used inside AppProviders");
  return value;
}

export function useDiscordProfiles(): DiscordDirectory {
  return useContext(DiscordContext);
}
