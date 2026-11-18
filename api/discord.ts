import { discordProfiles } from "./_lib/discord.js";
import { json } from "./_lib/http.js";

export async function GET(): Promise<Response> {
  try {
    return json(await discordProfiles());
  } catch (error) {
    console.error("[api/discord] GET failed", error instanceof Error ? error.message : "error");
    return json({ error: "Could not load Discord profiles." }, 500);
  }
}
