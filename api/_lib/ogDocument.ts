import { OWNER_DISCORD_ID, cleanText, mediaArt, DEFAULT_SEED, type MediaKind, type SiteConfig } from "../../shared/site.js";
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
import { readConfig, readEntries } from "./store.js";

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
}

let configCache: { at: number; value: SiteConfig } | null = null;

export async function buildOgDocument(request: Request): Promise<OgDocument> {
  const url = new URL(request.url);
  const card = cardFromPath(url.pathname) ?? cardFromQuery(url.searchParams.get("card")) ?? null;
  const origin = requestOrigin(request);
  const config = await loadConfig();
  const accent = /^#[0-9a-fA-F]{6}$/.test(config.color.seed) ? config.color.seed : DEFAULT_SEED;
  const owner = card === null || card === "profile" || card === "activity" ? await loadOwner(config.quote) : null;
  const quote = owner?.quote || spoken(config.quote);
  const name = owner?.name || "ThePotatoGamer";

  const built = await compose(card, config, owner, quote, name);
  const lines = built.lines.map((line) => clip(line, 80)).filter(Boolean).slice(0, 5);
  const description = clip(built.description || HOME_BLURB, 220);
  const heading = clip(built.heading, 48);
  const title = clip(built.title, 80);
  const stamp = contentStamp([title, description, heading, accent, built.picture ?? "", ...lines]);
  const image = new URL("/api/og", origin);
  if (card) image.searchParams.set("card", card);
  image.searchParams.set("v", stamp);

  return {
    card,
    title,
    description,
    kicker: built.kicker,
    heading,
    lines: lines.length > 0 ? lines : [HOME_BLURB],
    url: `${origin}${card ? `/${card}` : "/"}`,
    image: image.toString(),
    accent,
    picture: built.picture,
    pictureKind: built.picture ? built.pictureKind : null,
  };
}

async function compose(
  card: OgCard | null,
  config: SiteConfig,
  owner: OwnerSnapshot | null,
  quote: string,
  name: string,
): Promise<Pick<OgDocument, "title" | "description" | "kicker" | "heading" | "lines" | "picture" | "pictureKind">> {
  if (card === null) {
    const into = intoLine(config);
    return {
      title: "ThePotatoGamer",
      description: [quote, HOME_BLURB].filter(Boolean).join(" "),
      kicker: "Home",
      heading: name,
      lines: [quote, into].filter(Boolean),
      picture: owner?.avatar ?? null,
      pictureKind: owner?.avatar ? "avatar" : null,
    };
  }

  const meta = OG_CARDS[card];
  if (card === "profile") {
    const into = intoLine(config);
    return {
      title: name,
      description: [owner?.handle, quote, into].filter(Boolean).join(" "),
      kicker: meta.kicker,
      heading: name,
      lines: [owner?.handle ?? "", quote, into].filter(Boolean),
      picture: owner?.avatar ?? null,
      pictureKind: owner?.avatar ? "avatar" : null,
    };
  }

  if (card === "activity") {
    const lines = owner?.lines.length ? owner.lines : ["Nothing playing right now."];
    return {
      title: `${meta.heading} · ThePotatoGamer`,
      description: lines.join(" · "),
      kicker: meta.kicker,
      heading: meta.heading,
      lines,
      picture: owner?.avatar ?? null,
      pictureKind: owner?.avatar ? "avatar" : null,
    };
  }

  if (card === "interests") {
    const lines = config.interests.slice(0, 4).map(pair).filter(Boolean);
    if (config.interests.length > 4) lines.push(`+${config.interests.length - 4} more`);
    return textCard(meta, lines, "No interests yet.");
  }

  if (card === "links") {
    const lines = config.links.slice(0, 5).map((link) => pair({ label: link.title, value: link.handle }));
    return textCard(meta, lines.filter(Boolean), "No links yet.");
  }

  if (card === "friends") {
    const labels = config.friends.map((friend) => friend.label).filter(Boolean).slice(0, 5);
    const fallback = config.friends.length === 1 ? "1 friend" : `${config.friends.length} friends`;
    return textCard(meta, labels.length > 0 ? labels : config.friends.length > 0 ? [fallback] : [], "No friends added yet.");
  }

  if (card === "media") {
    const lines = config.media.slice(0, 4).map((item) => {
      const year = item.year ? ` (${item.year})` : "";
      return `${KIND_LABEL[item.kind]} — ${item.name}${year}`;
    });
    const poster = config.media.map((item) => mediaArt(item.poster, "w500")).find((art): art is string => Boolean(art)) ?? null;
    const cardText = textCard(meta, lines, "Nothing on rotation yet.");
    return { ...cardText, picture: poster, pictureKind: poster ? "poster" : null };
  }

  if (card === "setup" || card === "homelab") {
    const rows = card === "setup" ? config.setup : config.homelab;
    const lines = rows.slice(0, 5).map((row) => pair({ label: row.label, value: row.detail ? `${row.value} · ${row.detail}` : row.value }));
    return textCard(meta, lines.filter(Boolean), "No specs yet.");
  }

  const entries = await readEntries().catch(() => []);
  const lines = entries.slice(0, 4).map((entry) => pair({ label: entry.username, value: entry.message }));
  return textCard(meta, lines.filter(Boolean), "Sign the guestbook.");
}

function textCard(
  meta: { kicker: string; heading: string },
  lines: string[],
  empty: string,
): Pick<OgDocument, "title" | "description" | "kicker" | "heading" | "lines" | "picture" | "pictureKind"> {
  const body = lines.length > 0 ? lines : [empty];
  return {
    title: `${meta.heading} · ThePotatoGamer`,
    description: body.join(" · "),
    kicker: meta.kicker,
    heading: meta.heading,
    lines: body,
    picture: null,
    pictureKind: null,
  };
}

function intoLine(config: SiteConfig): string {
  const labels = config.interests.map((row) => row.label).filter(Boolean).slice(0, 6);
  if (labels.length === 0) return "";
  return `Into ${labels.join(", ")}`;
}

function pair(row: { label: string; value: string }): string {
  if (row.label && row.value) return `${row.label} — ${row.value}`;
  return row.label || row.value;
}

async function loadConfig(): Promise<SiteConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
  const value = await readConfig();
  configCache = { at: Date.now(), value };
  return value;
}

async function loadOwner(fallbackQuote: string): Promise<OwnerSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${OWNER_DISCORD_ID}`, { signal: controller.signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: unknown };
    const data = asRecord(body.data);
    if (!data) return null;
    const user = asRecord(data.discord_user);
    const id = cleanText(user?.id, 24);
    const username = cleanText(user?.username, 40);
    const name = cleanText(user?.global_name, 40) || username || "ThePotatoGamer";
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
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
