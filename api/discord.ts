import { discordProfiles, watchedIds } from "./_lib/discord.js";
import { loadStatuses } from "./_lib/discordPresence.js";
import { json } from "./_lib/http.js";

const SNOWFLAKE = /^\d{17,20}$/;

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const ids = await requestedIds(url);
    if (url.searchParams.get("part") === "statuses") return json({ statuses: await statuses(ids) });
    return json(await discordProfiles(ids));
  } catch (error) {
    console.error("[api/discord] GET failed", error instanceof Error ? error.message : "error");
    return json({ error: "Could not load Discord profiles." }, 500);
  }
}

async function statuses(ids: string[]): Promise<Record<string, { status: string; activity: string }>> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token || ids.length === 0) return {};
  return loadStatuses(ids, token);
}

async function requestedIds(url: URL): Promise<string[]> {
  const allowed = new Set(await watchedIds());
  const ids = new Set<string>();
  for (const id of (url.searchParams.get("ids") ?? "").split(",")) {
    const trimmed = id.trim();
    if (SNOWFLAKE.test(trimmed) && allowed.has(trimmed)) ids.add(trimmed);
  }
  return [...ids];
}
