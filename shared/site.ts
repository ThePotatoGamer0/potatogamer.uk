export const OWNER_DISCORD_ID = "639906782658953256";

export const ICON_NAMES = [
  "discord",
  "github",
  "youtube",
  "twitch",
  "kick",
  "instagram",
  "facebook",
  "x",
  "tiktok",
  "threads",
  "bluesky",
  "mastodon",
  "reddit",
  "telegram",
  "whatsapp",
  "snapchat",
  "pinterest",
  "tumblr",
  "steam",
  "spotify",
  "soundcloud",
  "patreon",
  "kofi",
  "mail",
  "link",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_LABELS: Record<IconName, string> = {
  discord: "Discord",
  github: "GitHub",
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  reddit: "Reddit",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  tumblr: "Tumblr",
  steam: "Steam",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  patreon: "Patreon",
  kofi: "Ko-fi",
  mail: "Mail",
  link: "Link",
};

export const SPEC_ICONS = ["cpu", "gpu", "memory-stick", "hard-drive", "circuit-board"] as const;

export type SpecIcon = (typeof SPEC_ICONS)[number];

export interface KvRow {
  id: string;
  label: string;
  value: string;
  image: string;
}

export interface SpecRow {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: SpecIcon;
}

export interface SiteLink {
  id: string;
  title: string;
  handle: string;
  url: string;
  icon: IconName;
}

export interface FriendConfig {
  id: string;
  discordId: string;
  label: string;
}

export const MEDIA_KINDS = ["movie", "tv", "anime", "game"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaPick {
  id: string;
  tmdbId: number;
  kind: MediaKind;
  name: string;
  year: string;
  overview: string;
  poster: string;
  backdrop: string;
}

export function tmdbImage(path: string, size: "w185" | "w500" | "w780"): string | null {
  if (!/^\/[A-Za-z0-9._/-]+$/.test(path)) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function remoteArt(value: unknown): string {
  if (typeof value !== "string" || value.length > 500) return "";
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.username || url.password) return "";
  const host = url.hostname.toLowerCase();
  if (host !== "steamgriddb.com" && !host.endsWith(".steamgriddb.com")) return "";
  return url.origin + url.pathname + url.search;
}

export function mediaArt(value: string, size: "w185" | "w500" | "w780"): string | null {
  return remoteArt(value) || tmdbImage(value, size);
}

export interface SiteColor {
  source: "auto" | "manual";
  seed: string;
}

export interface SiteConfig {
  quote: string;
  interests: KvRow[];
  setup: SpecRow[];
  homelab: SpecRow[];
  links: SiteLink[];
  friends: FriendConfig[];
  media: MediaPick[];
  color: SiteColor;
}

export interface GuestbookEntry {
  id: string;
  username: string;
  message: string;
  createdAt: string;
}

export type StorageMode = "kv" | "memory";

const DISCORD_ID = /^\d{17,20}$/;
const ROW_ID = /^[a-zA-Z0-9_-]{8,80}$/;

export const DEFAULT_SEED = "#E39B12";

export const defaultConfig: SiteConfig = {
  color: { source: "auto", seed: DEFAULT_SEED },
  quote: "Dual-booting the day and homelabbing the night.",
  interests: [
    {
      id: "interest-coding",
      label: "Coding",
      value: "TypeScript, web toys, and whatever the homelab needs next",
      image: "",
    },
    {
      id: "interest-linux",
      label: "Linux",
      value: "CachyOS on the daily driver",
      image: "",
    },
    {
      id: "interest-homelab",
      label: "Homelabbing",
      value: "A Raspberry Pi and a pile of self-hosted services",
      image: "",
    },
    {
      id: "interest-gaming",
      label: "Gaming",
      value: "Comfort games and late-night queues",
      image: "",
    },
  ],
  setup: [
    { id: "setup-cpu", label: "CPU", value: "Ryzen 5 7600", detail: "", icon: "cpu" },
    { id: "setup-gpu", label: "GPU", value: "GeForce RTX 3060", detail: "", icon: "gpu" },
    { id: "setup-memory", label: "Memory", value: "32GB", detail: "6000MT/s", icon: "memory-stick" },
    { id: "setup-storage-cachy", label: "Storage", value: "2 TB NVMe", detail: "CachyOS", icon: "hard-drive" },
    { id: "setup-storage-windows", label: "Storage", value: "512 GB NVMe", detail: "Windows", icon: "hard-drive" },
    { id: "setup-board", label: "Motherboard", value: "A620M Pro RS WiFi", detail: "", icon: "circuit-board" },
  ],
  homelab: [
    { id: "homelab-apu", label: "APU", value: "BCM2712", detail: "Cortex-A76", icon: "cpu" },
    { id: "homelab-gpu", label: "GPU", value: "VideoCore VII", detail: "", icon: "gpu" },
    { id: "homelab-memory", label: "Memory", value: "16GB", detail: "", icon: "memory-stick" },
    { id: "homelab-storage", label: "Storage", value: "1 TB NVMe", detail: "Raspberry Pi OS Lite", icon: "hard-drive" },
  ],
  links: [
    {
      id: "link-discord",
      title: "Discord",
      handle: "thepotatogamer",
      url: "https://discord.com/users/639906782658953256",
      icon: "discord",
    },
    {
      id: "link-github",
      title: "GitHub",
      handle: "thepotatogamer0",
      url: "https://github.com/thepotatogamer0",
      icon: "github",
    },
  ],
  friends: [],
  media: [],
};

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isHttpUrl(trimmed)) return null;
  return trimmed;
}

function cleanId(value: unknown): string {
  if (typeof value === "string" && ROW_ID.test(value)) return value;
  return crypto.randomUUID();
}

function isIcon(value: unknown): value is IconName {
  return typeof value === "string" && (ICON_NAMES as readonly string[]).includes(value);
}

const LEGACY_SETUPS = new Set([
  [
    "Main Rig|Dual-boot Windows 11 & CachyOS",
    "Homelab|Raspberry Pi 5 16GB + 1TB NVMe on Raspberry Pi OS Lite",
    "Editor|Cursor",
    "Shell|zsh",
  ].join("||"),
  [
    "CPU|Ryzen 5 7600",
    "GPU|GeForce RTX 3060",
    "Memory|32 GB",
    "Storage|2 TB NVMe · 512 GB NVMe",
    "Board|A620M Pro RS WiFi",
    "OS|CachyOS & Windows 11",
  ].join("||"),
  [
    "CPU|Ryzen 5 7600",
    "GPU|GeForce RTX 3060",
    "Memory|32GB 6000MT/s",
    "Storage|2 TB NVMe",
    "Storage|512 GB NVMe",
    "Motherboard|A620M Pro RS WiFi",
  ].join("||"),
  ["Board|Raspberry Pi 5", "Memory|16GB", "Storage|1 TB NVMe"].join("||"),
  ["APU|BCM2712", "Board|Raspberry Pi 5", "Memory|16GB", "Storage|1 TB NVMe"].join("||"),
  ["APU|BCM2712", "GPU|VideoCore VII", "Board|Raspberry Pi 5", "Memory|16GB", "Storage|1 TB NVMe"].join("||"),
]);

const SPEC_ICON_ALIASES: Record<string, SpecIcon> = {
  cpu: "cpu",
  gpu: "gpu",
  memory: "memory-stick",
  "memory-stick": "memory-stick",
  storage: "hard-drive",
  "hard-drive": "hard-drive",
  board: "circuit-board",
  motherboard: "circuit-board",
  "circuit-board": "circuit-board",
};

function specIconFor(label: string): SpecIcon {
  const key = label.toLowerCase();
  if (key.includes("cpu") || key.includes("processor")) return "cpu";
  if (key.includes("gpu") || key.includes("graphics")) return "gpu";
  if (key.includes("memory") || key.includes("ram")) return "memory-stick";
  if (key.includes("storage") || key.includes("ssd") || key.includes("nvme") || key.includes("drive")) return "hard-drive";
  if (key.includes("board") || key.includes("motherboard")) return "circuit-board";
  return "cpu";
}

function normalizeSpecIcon(value: unknown, label: string): SpecIcon {
  if (typeof value === "string" && value in SPEC_ICON_ALIASES) return SPEC_ICON_ALIASES[value];
  return specIconFor(label);
}

function takeSpecs(value: unknown, limit: number, fallback: SpecRow[], replaceLegacy = false): SpecRow[] {
  if (!Array.isArray(value)) return fallback;
  const rows: SpecRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<SpecRow>;
    const label = cleanText(record.label, 40);
    const rowValue = cleanText(record.value, 80);
    if (!label && !rowValue) continue;
    rows.push({
      id: cleanId(record.id),
      label,
      value: rowValue,
      detail: cleanText(record.detail, 40),
      icon: normalizeSpecIcon(record.icon, label),
    });
    if (rows.length >= limit) break;
  }
  const signature = rows.map((row) => `${row.label}|${row.value}`).join("||");
  return replaceLegacy && LEGACY_SETUPS.has(signature) ? fallback : rows;
}

function takeRows(value: unknown, limit: number, mode: "read" | "write"): { ok: true; items: KvRow[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    if (mode === "read") return { ok: true, items: defaultConfig.interests };
    return { ok: false, error: "Interests must be a list." };
  }
  const rows: KvRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<KvRow>;
    const label = cleanText(record.label, 80);
    const rowValue = cleanText(record.value, 240);
    const image = interestImage(record.image);
    if (!label && !rowValue && !image.raw) continue;
    if (image.error) {
      if (mode === "write") {
        return { ok: false, error: `“${label || "Interest"}” needs a picture from the file picker or clipboard, or leave it blank.` };
      }
    }
    if (!label && !rowValue) continue;
    rows.push({ id: cleanId(record.id), label, value: rowValue, image: image.url });
    if (rows.length >= limit) break;
  }
  if (mode === "write") {
    const weight = rows.reduce((sum, row) => sum + row.image.length, 0);
    if (weight > 700_000) {
      return { ok: false, error: "Those pictures are too large to save together. Clear one, or choose a simpler image." };
    }
  }
  return { ok: true, items: rows };
}

const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i;

function interestImage(value: unknown): { url: string; raw: string; error: boolean } {
  if (typeof value !== "string") return { url: "", raw: "", error: false };
  const raw = value.trim();
  if (!raw) return { url: "", raw: "", error: false };
  if (raw.startsWith("data:")) {
    const compact = raw.replace(/\s/g, "");
    if (compact.length > 48_000 || !DATA_IMAGE.test(compact)) return { url: "", raw, error: true };
    return { url: compact, raw, error: false };
  }
  if (raw.length > 800) return { url: "", raw, error: true };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return { url: "", raw, error: true };
    return { url: raw, raw, error: false };
  } catch {
    return { url: "", raw, error: true };
  }
}

export type ConfigResult =
  | { ok: true; config: SiteConfig }
  | { ok: false; error: string };

export function normalizeConfig(input: unknown, mode: "read" | "write"): ConfigResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (mode === "read") return { ok: true, config: defaultConfig };
    return { ok: false, error: "Config must be a JSON object." };
  }

  const source = input as Partial<SiteConfig>;
  const links = normalizeLinks(source.links, mode);
  if (!links.ok) return links;
  const friends = normalizeFriends(source.friends, mode);
  if (!friends.ok) return friends;
  const media = normalizeMedia(source.media, mode);
  if (!media.ok) return media;
  const interests = source.interests === undefined
    ? { ok: true as const, items: defaultConfig.interests }
    : takeRows(source.interests, 24, mode);
  if (!interests.ok) return interests;

  return {
    ok: true,
    config: {
      quote: source.quote === undefined ? defaultConfig.quote : cleanText(source.quote, 280),
      interests: interests.items,
      setup: takeSpecs(source.setup, 24, defaultConfig.setup, true),
      homelab: takeSpecs(source.homelab, 24, defaultConfig.homelab, true),
      links: links.items,
      friends: friends.items,
      media: media.items,
      color: normalizeColor(source.color),
    },
  };
}

function normalizeColor(value: unknown): SiteColor {
  if (!value || typeof value !== "object") return defaultConfig.color;
  const record = value as Partial<SiteColor>;
  const seed = typeof record.seed === "string" && /^#[0-9a-fA-F]{6}$/.test(record.seed) ? record.seed : DEFAULT_SEED;
  return { source: record.source === "manual" ? "manual" : "auto", seed };
}

function normalizeLinks(
  value: unknown,
  mode: "read" | "write",
): { ok: true; items: SiteLink[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, items: defaultConfig.links };
  if (!Array.isArray(value)) {
    if (mode === "read") return { ok: true, items: defaultConfig.links };
    return { ok: false, error: "Links must be a list." };
  }

  const items: SiteLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<SiteLink>;
    const title = cleanText(record.title, 40);
    const handle = cleanText(record.handle, 80);
    const url = cleanText(record.url, 300);
    if (!title && !handle && !url) continue;
    if (!title || !url) {
      if (mode === "write") return { ok: false, error: "Each link needs a title and a URL." };
      continue;
    }
    if (!isHttpUrl(url)) {
      if (mode === "write") return { ok: false, error: `Link “${title}” needs an http or https URL.` };
      continue;
    }
    items.push({
      id: cleanId(record.id),
      title,
      handle,
      url,
      icon: isIcon(record.icon) ? record.icon : "link",
    });
    if (items.length >= 12) break;
  }
  return { ok: true, items };
}

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

function mediaId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

function mediaPath(value: unknown): string {
  return typeof value === "string" && /^\/[A-Za-z0-9._/-]+$/.test(value) ? value : "";
}

function normalizeMedia(
  value: unknown,
  mode: "read" | "write",
): { ok: true; items: MediaPick[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, items: [] };
  if (!Array.isArray(value)) {
    if (mode === "read") return { ok: true, items: [] };
    return { ok: false, error: "Media must be a list." };
  }

  const items: MediaPick[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<MediaPick> & { title?: unknown };
    const name = cleanText(record.name ?? record.title, 120);
    const tmdbId = mediaId(record.tmdbId);
    if (!name || tmdbId === null || !isMediaKind(record.kind)) {
      if (mode === "write" && (name || record.tmdbId !== undefined || record.kind !== undefined)) {
        return {
          ok: false,
          error:
            record.kind === "game"
              ? "Each game has to be chosen from the search."
              : "Each title has to be chosen from the search.",
        };
      }
      continue;
    }
    const game = record.kind === "game";
    const poster = game ? remoteArt(record.poster) : mediaPath(record.poster);
    const backdrop = game ? remoteArt(record.backdrop) : mediaPath(record.backdrop);
    if (game && !poster) {
      if (mode === "write") return { ok: false, error: "Each game has to be chosen from the search." };
      continue;
    }
    items.push({
      id: cleanId(record.id),
      tmdbId,
      kind: record.kind,
      name,
      year: cleanText(record.year, 4).replace(/\D/g, "").slice(0, 4),
      overview: cleanText(record.overview, 180),
      poster,
      backdrop,
    });
    if (items.length >= 24) break;
  }
  return { ok: true, items };
}

function normalizeFriends(
  value: unknown,
  mode: "read" | "write",
): { ok: true; items: FriendConfig[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, items: [] };
  if (!Array.isArray(value)) {
    if (mode === "read") return { ok: true, items: [] };
    return { ok: false, error: "Friends must be a list." };
  }

  const items: FriendConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<FriendConfig>;
    const discordId = cleanText(record.discordId, 24);
    const label = cleanText(record.label, 40);
    if (!discordId && !label) continue;
    if (!DISCORD_ID.test(discordId)) {
      if (mode === "write") {
        return { ok: false, error: "Friend Discord IDs are 17–20 digit snowflakes." };
      }
      continue;
    }
    items.push({ id: cleanId(record.id), discordId, label });
    if (items.length >= 20) break;
  }
  return { ok: true, items };
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function validateGuestbook(input: {
  username: unknown;
  message: unknown;
}): { ok: true; username: string; message: string } | { ok: false; error: string } {
  const username = cleanText(input.username, 20);
  const message = cleanText(input.message, 200);
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "Username must be 3–20 letters, numbers, or underscores." };
  }
  if (!message) return { ok: false, error: "Message can’t be empty." };
  if (message.length > 200) return { ok: false, error: "Message must be 200 characters or fewer." };
  return { ok: true, username, message };
}
