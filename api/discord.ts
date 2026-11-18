import { discordProfiles, watchedIds } from "./_lib/discord.js";
import { loadStatuses } from "./_lib/discordPresence.js";
import { json } from "./_lib/http.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const part = new URL(request.url).searchParams.get("part");
    if (part === "statuses") return json({ statuses: await statuses() });
    return json(await discordProfiles());
  } catch (error) {
    console.error("[api/discord] GET failed", error instanceof Error ? error.message : "error");
    return json({ error: "Could not load Discord profiles." }, 500);
  }
}

async function statuses(): Promise<Record<string, { status: string; activity: string }>> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token) return {};
  return loadStatuses(await watchedIds(), token);
}
