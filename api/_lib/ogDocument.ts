import { cleanText, isDiscordId, mediaArt, DEFAULT_SEED, type MediaKind, type SiteConfig } from "../../shared/site.js";
import {
  OG_CARDS,
  cardFromPath,
  cardFromQuery,
  clip,
  contentStamp,
  spoken,
  type OgCard,
  type OgDocument,
} from "../../shared/og.js";
import { discordProfiles, type PublicDiscordUser } from "./discord.js";
import { samplePngSeed } from "./samplePng.js";
import { requestHost } from "./host.js";
import { readEntries, readSite } from "./store.js";

const HOME_BLURB = "Live Discord presence, interests, setup, and a guestbook.";
const CONFIG_TTL_MS = 20_000;

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

const KIND_LABEL: Record<MediaKind, string> = {
  movie: "Movie",
  tv: "Show",
  anime: "Anime",
  game: "Game",
};

interface OwnerSnapshot {
  name: string;
  handle: string;
  avatar: string | null;
  quote: string;
  lines: string[];
  activity: ActivityPreview;
}

interface ActivityPreview {
  status: string;
  statusLabel: string;
  custom: string;
  kind: string;
  title: string;
  detail: string;
  image: string | null;
}

const configCache = new Map<string, { at: number; value: SiteConfig }>();

export async function buildOgDocument(request: Request): Promise<OgDocument> {
  const url = new URL(request.url);
  const card = cardFromPath(url.pathname) ?? cardFromQuery(url.searchParams.get("card")) ?? null;
  const origin = requestOrigin(request);
  const host = requestHost(request);
  const config = await loadConfig(host);
  const storedSeed = /^#[0-9a-fA-F]{6}$/.test(config.color.seed) ? config.color.seed : DEFAULT_SEED;
  const owner = await loadOwner(config.identity.discordId, config.quote, config.identity.name);
  const accent = config.color.source === "manual" ? storedSeed : (await avatarSeed(owner?.avatar)) || storedSeed;
  const quote = owner?.quote || spoken(config.quote);
  const name = owner?.name || config.identity.name || "Home";
  const siteName = config.identity.siteName || name;

  const built = await compose(card, config, owner, quote, name, siteName, host);
  const lines = built.lines.map((line) => clip(line, 90)).filter(Boolean).slice(0, 6);
  const items = built.items
    .map((item) => ({
      label: clip(item.label, 48),
      detail: clip(item.detail, 72),
      image: item.image,
      mark: item.mark,
    }))
    .filter((item) => item.label || item.detail || item.image)
    .slice(0, 6);
  const description = card ? `All of ${name} - ${cardMeta(card, config).kicker}` : `All of ${name}`;
  const heading = clip(built.heading, 48);
  const lede = clip(built.lede, 160);
  const title = clip(built.title, 80);
  const stamp = contentStamp([
    "card-profile",
    title,
    description,
    heading,
    lede,
    accent,
    built.picture ?? "",
    ...lines,
    ...items.flatMap((item) => [item.label, item.detail, item.image ?? "", item.mark ?? ""]),
  ]);
  const image = new URL("/api/og", origin);
  if (card) image.searchParams.set("card", card);
  image.searchParams.set("v", stamp);

  return {
    card,
    title,
    description,
    kicker: built.kicker,
    heading,
    lede,
    lines: lines.length > 0 ? lines : [HOME_BLURB],
    items,
    layout: built.layout,
    url: `${origin}${card ? `/${card}` : "/"}`,
    image: image.toString(),
    accent,
    picture: built.picture,
    pictureKind: built.picture ? built.pictureKind : null,
    siteName,
  };
}

function cardMeta(card: OgCard, config: SiteConfig): { kicker: string; heading: string } {
  if (card === "interests") return { kicker: "Interests", heading: config.identity.interestsTitle };
  if (card === "setup") return { kicker: config.identity.setupKicker, heading: config.identity.setupTitle };
  if (card === "homelab") return { kicker: config.identity.homelabKicker, heading: config.identity.homelabTitle };
  return OG_CARDS[card];
}

async function compose(
  card: OgCard | null,
  config: SiteConfig,
  owner: OwnerSnapshot | null,
  quote: string,
  name: string,
  siteName: string,
  host: string,
): Promise<Pick<OgDocument, "title" | "kicker" | "heading" | "lede" | "lines" | "items" | "layout" | "picture" | "pictureKind">> {
  if (card === null || card === "profile") {
    const chips = config.interests.slice(0, 6).map((row) => item(row.label, "", previewImage(row.image)));
    const into = intoLine(config);
    const meta = card === "profile" ? OG_CARDS.profile : { kicker: "Profile", heading: name };
    return {
      title: card === "profile" ? name : siteName,
      kicker: meta.kicker,
      heading: name,
      lede: quote,
      lines: [owner?.handle ?? "", quote, into].filter(Boolean),
      items: chips,
      layout: "profile",
      picture: owner?.avatar ?? null,
      pictureKind: owner?.avatar ? "avatar" : null,
    };
  }

  const meta = cardMeta(card, config);
  if (card === "activity") {
    const playing = owner?.activity ?? emptyActivity();
    const lines = owner?.lines.length ? owner.lines : ["Nothing playing right now."];
    return {
      title: `${meta.heading} · ${siteName}`,
      kicker: meta.kicker,
      heading: meta.heading,
      lede: "",
      lines,
      items: [
        item(playing.statusLabel, playing.custom, null, `st:${playing.status}`),
        item(playing.title || "No game, IDE, or track running.", playing.detail, playing.image, playing.kind),
      ],
      layout: "activity",
      picture: null,
      pictureKind: null,
    };
  }

  if (card === "interests") {
    const items = config.interests.slice(0, 6).map((row) => item(row.label, row.value, previewImage(row.image)));
    const lines = items.map((entry) => pair(entry));
    if (config.interests.length > 6) lines.push(`+${config.interests.length - 6} more`);
    return filled(meta, lines, items, "tiles", "No interests yet.", siteName);
  }

  if (card === "links") {
    const items = config.links.slice(0, 5).map((link) => item(link.title, link.handle, null, `si:${link.icon}`));
    return filled(meta, items.map((entry) => pair(entry)), items, "rows", "No links yet.", siteName);
  }

  if (card === "friends") {
    const items = await loadFriendCards(config.friends);
    const fallback = config.friends.length === 1 ? "1 friend" : `${config.friends.length} friends`;
    return filled(
      meta,
      items.length > 0 ? items.map((entry) => entry.label) : config.friends.length > 0 ? [fallback] : [],
      items,
      "rows",
      "No friends added yet.",
      siteName,
    );
  }

  if (card === "media") {
    const items = config.media.slice(0, 4).map((entry) => {
      const year = entry.year ? ` (${entry.year})` : "";
      return item(`${entry.name}${year}`, KIND_LABEL[entry.kind], mediaArt(entry.poster, "w500"));
    });
    const poster = items.map((entry) => entry.image).find((art): art is string => Boolean(art)) ?? null;
    const cardText = filled(meta, items.map((entry) => pair(entry)), items, "media", "Nothing on rotation yet.", siteName);
    return { ...cardText, picture: poster, pictureKind: poster ? "poster" : null };
  }

  if (card === "setup" || card === "homelab") {
    const rows = card === "setup" ? config.setup : config.homelab;
    const items = rows.slice(0, 6).map((row) => item(row.label, row.detail ? `${row.value} · ${row.detail}` : row.value, null, `lu:${row.icon}`));
    return filled(meta, items.map((entry) => pair(entry)), items, "specs", "No specs yet.", siteName);
  }

  const entries = await readEntries(host).catch(() => []);
  const items = entries.slice(0, 4).map((entry) => item(entry.username, entry.message, null));
  return filled(meta, items.map((entry) => pair(entry)), items, "rows", "Sign the guestbook.", siteName);
}

function filled(
  meta: { kicker: string; heading: string },
  lines: string[],
  items: OgDocument["items"],
  layout: OgDocument["layout"],
  empty: string,
  siteName: string,
): Pick<OgDocument, "title" | "kicker" | "heading" | "lede" | "lines" | "items" | "layout" | "picture" | "pictureKind"> {
  const body = lines.filter(Boolean);
  const shown = body.length > 0 ? body : [empty];
  return {
    title: `${meta.heading} · ${siteName}`,
    kicker: meta.kicker,
    heading: meta.heading,
    lede: "",
    lines: shown,
    items: items.length > 0 ? items : [item(empty, "", null)],
    layout,
    picture: null,
    pictureKind: null,
  };
}

function item(label: string, detail: string, image: string | null, mark: string | null = null): OgDocument["items"][number] {
  return { label, detail, image, mark };
}

function previewImage(value: string): string | null {
  if (!value || value.length > 120_000) return null;
  if (value.startsWith("data:image/") && !value.startsWith("data:image/svg")) return value;
  return null;
}

function intoLine(config: SiteConfig): string {
  const labels = config.interests.map((row) => row.label).filter(Boolean).slice(0, 6);
  if (labels.length === 0) return "";
  return `Into ${labels.join(", ")}`;
}

function pair(row: { label: string; detail: string }): string {
  if (row.label && row.detail) return `${row.label} — ${row.detail}`;
  return row.label || row.detail;
}

const seedCache = new Map<string, string>();

async function avatarSeed(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const cached = seedCache.get(url);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const seed = samplePngSeed(Buffer.from(await response.arrayBuffer()));
    if (seed) seedCache.set(url, seed);
    return seed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadConfig(host: string): Promise<SiteConfig> {
  const hit = configCache.get(host);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.value;
  const { config } = await readSite(host);
  configCache.set(host, { at: Date.now(), value: config });
  return config;
}

async function loadOwner(discordId: string, fallbackQuote: string, fallbackName: string): Promise<OwnerSnapshot | null> {
  if (!isDiscordId(discordId)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`, { signal: controller.signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: unknown };
    const data = asRecord(body.data);
    if (!data) return null;
    const user = asRecord(data.discord_user);
    const id = cleanText(user?.id, 24);
    const username = cleanText(user?.username, 40);
    const name = cleanText(user?.global_name, 40) || username || fallbackName;
    const avatarHash = cleanText(user?.avatar, 64);
    const avatar = id && /^[A-Za-z0-9_]+$/.test(avatarHash)
      ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png?size=256`
      : null;
    const kv = asRecord(data.kv);
    const quote = spoken(cleanText(kv?.quote, 180) || fallbackQuote);
    return {
      name,
      handle: username ? `@${username}` : "",
      avatar,
      quote,
      lines: activityLines(data),
      activity: activityPreview(data),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function emptyActivity(): ActivityPreview {
  return { status: "offline", statusLabel: "Offline", custom: "", kind: "", title: "", detail: "", image: null };
}

function activityPreview(data: Record<string, unknown>): ActivityPreview {
  const status = cleanText(data.discord_status, 16);
  const known = STATUS_LABEL[status] ? status : "offline";
  const preview: ActivityPreview = {
    status: known,
    statusLabel: STATUS_LABEL[known] ?? "Offline",
    custom: "",
    kind: "",
    title: "",
    detail: "",
    image: null,
  };

  const activities = Array.isArray(data.activities) ? data.activities : [];
  for (const entry of activities) {
    const activity = asRecord(entry);
    if (activity?.type !== 4) continue;
    preview.custom = cleanText(activity.state, 80);
    break;
  }

  const spotify = asRecord(data.spotify);
  if (data.listening_to_spotify === true && spotify) {
    const song = cleanText(spotify.song, 80);
    const artist = cleanText(spotify.artist, 80);
    const album = cleanText(spotify.album, 80);
    preview.kind = "Listening to Spotify";
    preview.title = song;
    preview.detail = [artist, album].filter(Boolean).join(" · ");
    preview.image = httpsUrl(spotify.album_art_url);
    return preview;
  }

  for (const entry of activities) {
    const activity = asRecord(entry);
    if (!activity || activity.type === 4) continue;
    const name = cleanText(activity.name, 60);
    if (!name || name === "Spotify") continue;
    const assets = asRecord(activity.assets);
    preview.kind = `${activityKind(activity.type)} ${name}`;
    preview.title = cleanText(activity.details, 80) || name;
    preview.detail = cleanText(activity.state, 80);
    preview.image = discordAsset(cleanText(activity.application_id, 24), cleanText(assets?.large_image, 400));
    break;
  }
  return preview;
}

async function loadFriendCards(friends: SiteConfig["friends"]): Promise<OgDocument["items"]> {
  const shown = friends.slice(0, 5);
  const ids = shown.map((friend) => friend.discordId).filter((id) => /^\d{17,20}$/.test(id));
  const [directory, live] = await Promise.all([
    discordProfiles(ids).catch(() => ({ configured: false, users: {} as Record<string, PublicDiscordUser | null> })),
    lanyardUsers(ids),
  ]);
  return shown.map((friend) => {
    const profile = directory.users[friend.discordId] ?? null;
    const presence = live.get(friend.discordId) ?? null;
    const name = presence?.name || profile?.global_name || profile?.username || friend.label || "Discord user";
    const username = presence?.username || profile?.username || "";
    const avatar = presence?.avatar || (profile ? discordAvatar(profile.id, profile.avatar) : null);
    const status = presence?.status && STATUS_LABEL[presence.status] ? presence.status : "";
    return item(name, username ? `@${username}` : "", avatar, status ? `st:${status}` : null);
  });
}

async function lanyardUsers(ids: string[]): Promise<Map<string, { name: string; username: string; avatar: string | null; status: string }>> {
  const entries = await Promise.all(ids.map(async (id) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`https://api.lanyard.rest/v1/users/${id}`, { signal: controller.signal });
      if (!response.ok) return null;
      const body = (await response.json()) as { data?: unknown };
      const data = asRecord(body.data);
      const user = asRecord(data?.discord_user);
      if (!user) return null;
      const username = cleanText(user.username, 40);
      const name = cleanText(user.global_name, 40) || username;
      const avatarHash = cleanText(user.avatar, 64);
      const userId = cleanText(user.id, 24);
      return [id, {
        name,
        username,
        avatar: discordAvatar(userId, avatarHash),
        status: cleanText(data?.discord_status, 16),
      }] as const;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }));
  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)));
}

function discordAvatar(id: string, hash: string | null): string | null {
  if (!/^\d{17,20}$/.test(id)) return null;
  if (hash && /^[A-Za-z0-9_]+$/.test(hash)) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  try {
    const index = Number((BigInt(id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return null;
  }
}

function httpsUrl(value: unknown): string | null {
  const text = cleanText(value, 300);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function discordAsset(applicationId: string, asset: string): string | null {
  if (asset.startsWith("mp:external/")) {
    const rest = asset.slice("mp:external/".length);
    return /^[\w./%-]+$/.test(rest) ? `https://media.discordapp.net/external/${rest}` : null;
  }
  if (asset.startsWith("spotify:")) {
    const id = asset.slice("spotify:".length);
    return /^[\w-]+$/.test(id) ? `https://i.scdn.co/image/${id}` : null;
  }
  if (!/^[\w-]+$/.test(applicationId) || !/^[\w-]+$/.test(asset)) return null;
  return `https://cdn.discordapp.com/app-assets/${applicationId}/${asset}.png`;
}

function activityLines(data: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const status = cleanText(data.discord_status, 16);
  if (STATUS_LABEL[status]) lines.push(STATUS_LABEL[status]);

  const spotify = asRecord(data.spotify);
  if (data.listening_to_spotify === true && spotify) {
    const song = cleanText(spotify.song, 80);
    const artist = cleanText(spotify.artist, 80);
    if (song) lines.push(artist ? `${song} — ${artist}` : song);
  }

  const activities = Array.isArray(data.activities) ? data.activities.slice(0, 6) : [];
  for (const item of activities) {
    const activity = asRecord(item);
    if (!activity) continue;
    const type = activity.type;
    const name = cleanText(activity.name, 60);
    if (type === 4) {
      const state = cleanText(activity.state, 80);
      if (state) lines.push(state);
      continue;
    }
    if (!name || name === "Spotify") continue;
    const detail = [cleanText(activity.details, 80), cleanText(activity.state, 80)].filter(Boolean).join(" — ");
    lines.push(detail ? `${activityKind(type)} ${name} — ${detail}` : `${activityKind(type)} ${name}`);
  }

  if (lines.length === 0) lines.push("Nothing playing right now.");
  return lines;
}

function activityKind(type: unknown): string {
  switch (type) {
    case 0:
      return "Playing";
    case 1:
      return "Streaming";
    case 2:
      return "Listening";
    case 3:
      return "Watching";
    case 5:
      return "Competing";
    default:
      return "Activity";
  }
}

function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || url.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
