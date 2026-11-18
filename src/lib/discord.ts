import type { DiscordUser } from "./lanyard";

export function avatarUrl(user: Pick<DiscordUser, "id" | "avatar">, size = 256): string {
  if (!user.avatar) return defaultAvatarUrl(user.id);
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`;
}

export function defaultAvatarUrl(id: string): string {
  let index = 0;
  try {
    index = Number((BigInt(id) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function decorationUrl(asset: string): string {
  return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=240`;
}

export function emojiUrl(emoji: { id?: string | null; animated?: boolean } | null | undefined): string | null {
  if (!emoji?.id) return null;
  const extension = emoji.animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${extension}?size=64&quality=lossless`;
}

export function discordAssetUrl(applicationId: string | undefined, asset: string | undefined): string | null {
  if (!asset) return null;
  if (asset.startsWith("mp:external/")) {
    return `https://media.discordapp.net/external/${asset.slice("mp:external/".length)}`;
  }
  if (asset.startsWith("spotify:")) {
    return `https://i.scdn.co/image/${asset.slice("spotify:".length)}`;
  }
  if (!applicationId) return null;
  return `https://cdn.discordapp.com/app-assets/${applicationId}/${asset}.png`;
}

export function displayName(user: DiscordUser | undefined, fallback = "ThePotatoGamer"): string {
  if (!user) return fallback;
  return user.global_name || user.display_name || user.username || fallback;
}

export function kvString(kv: Record<string, unknown> | undefined, key: string): string {
  const value = kv?.[key];
  return typeof value === "string" ? value.trim() : "";
}
