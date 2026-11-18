export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  display_name?: string | null;
  avatar: string | null;
  avatar_decoration_data?: { asset: string } | null;
}

export interface LanyardEmoji {
  id?: string | null;
  name: string;
  animated?: boolean;
}

export interface LanyardActivity {
  type: number;
  name: string;
  state?: string | null;
  details?: string | null;
  application_id?: string;
  emoji?: LanyardEmoji | null;
  timestamps?: { start?: number; end?: number };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
}

export interface LanyardSpotify {
  track_id: string;
  timestamps: { start: number; end: number };
  song: string;
  artist: string;
  album_art_url: string;
  album: string;
}

export type DiscordStatus = "online" | "idle" | "dnd" | "offline";

export interface LanyardPresence {
  kv?: Record<string, unknown>;
  discord_user: DiscordUser;
  discord_status: DiscordStatus;
  activities: LanyardActivity[];
  listening_to_spotify: boolean;
  spotify: LanyardSpotify | null;
  active_on_discord_desktop?: boolean;
  active_on_discord_mobile?: boolean;
  active_on_discord_web?: boolean;
}

export const LANYARD_REST = "https://api.lanyard.rest/v1/users";
export const LANYARD_WS = "wss://api.lanyard.rest/socket";

export const STATUS_LABEL: Record<DiscordStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

export function platformLabel(presence: LanyardPresence): string | null {
  if (presence.active_on_discord_desktop) return "Desktop";
  if (presence.active_on_discord_mobile) return "Mobile";
  if (presence.active_on_discord_web) return "Web";
  return null;
}

export function activityKind(type: number): string {
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

export function isPresence(value: unknown): value is LanyardPresence {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LanyardPresence>;
  return Boolean(record.discord_user && typeof record.discord_user.id === "string" && record.discord_status);
}

export async function fetchPresence(id: string, signal?: AbortSignal): Promise<LanyardPresence | null> {
  const response = await fetch(`${LANYARD_REST}/${id}`, { signal });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: unknown };
  return isPresence(body.data) ? body.data : null;
}
