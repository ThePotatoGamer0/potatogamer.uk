import { isDiscordId } from "../../shared/site.js";
import { readSite } from "./store.js";

const SNOWFLAKE = /^\d{17,20}$/;
const TTL_MS = 15 * 60 * 1000;
const MISS_TTL_MS = 5 * 60 * 1000;

export interface PublicDiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  avatar_decoration_data?: { asset: string } | null;
  collectibles?: { nameplate?: { asset: string; label?: string; palette?: string } | null } | null;
}

interface CacheEntry {
  expires: number;
  user: PublicDiscordUser | null;
}

const cache = new Map<string, CacheEntry>();

export async function discordProfiles(ids: string[]): Promise<{
  configured: boolean;
  users: Record<string, PublicDiscordUser | null>;
}> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token || ids.length === 0) return { configured: Boolean(token), users: {} };

  const entries = await Promise.all(ids.map(async (id) => [id, await lookup(id, token)] as const));
  return { configured: true, users: Object.fromEntries(entries) };
}

export async function watchedIds(host: string): Promise<string[]> {
  const { config } = await readSite(host);
  const ids = new Set<string>();
  if (isDiscordId(config.identity.discordId)) ids.add(config.identity.discordId);
  for (const friend of config.friends) {
    if (SNOWFLAKE.test(friend.discordId)) ids.add(friend.discordId);
  }
  return [...ids];
}

async function lookup(id: string, token: string): Promise<PublicDiscordUser | null> {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.user;

  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: {
        Authorization: `Bot ${token}`,
        Accept: "application/json",
        "User-Agent": "potatogamer.uk (https://potatogamer.uk)",
      },
      redirect: "manual",
    });
  } catch (error) {
    console.error("[api/discord] request failed", id, error instanceof Error ? error.message : "error");
    return null;
  }

  if (response.status === 404) {
    cache.set(id, { expires: Date.now() + MISS_TTL_MS, user: null });
    return null;
  }
  if (!response.ok) {
    console.error("[api/discord] lookup failed", id, response.status);
    return null;
  }

  const user = publicUser(await response.json().catch(() => null));
  if (user) cache.set(id, { expires: Date.now() + TTL_MS, user });
  return user;
}

function publicUser(value: unknown): PublicDiscordUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !SNOWFLAKE.test(record.id) || typeof record.username !== "string") return null;
  const decoration = record.avatar_decoration_data;
  const asset =
    decoration && typeof decoration === "object" && typeof (decoration as { asset?: unknown }).asset === "string"
      ? (decoration as { asset: string }).asset
      : "";
  return {
    id: record.id,
    username: record.username,
    global_name: typeof record.global_name === "string" ? record.global_name : null,
    avatar: typeof record.avatar === "string" ? record.avatar : null,
    avatar_decoration_data: asset ? { asset } : null,
    collectibles: publicNameplate(record.collectibles),
  };
}

function publicNameplate(value: unknown): PublicDiscordUser["collectibles"] {
  if (!value || typeof value !== "object") return null;
  const nameplate = (value as { nameplate?: unknown }).nameplate;
  if (!nameplate || typeof nameplate !== "object") return null;
  const asset = (nameplate as { asset?: unknown }).asset;
  if (typeof asset !== "string" || !/^nameplates\/(?:[a-z0-9_-]+\/)+$/i.test(asset)) return null;
  const label = (nameplate as { label?: unknown }).label;
  const palette = (nameplate as { palette?: unknown }).palette;
  return {
    nameplate: {
      asset,
      label: typeof label === "string" ? label : undefined,
      palette: typeof palette === "string" ? palette : undefined,
    },
  };
}
