import { MEDIA_KINDS, type MediaKind } from "../shared/site.js";
import { json, requireAuth } from "./_lib/http.js";
import { searchGames } from "./_lib/steamgriddb.js";
import { searchTitles } from "./_lib/tmdb.js";

export async function GET(request: Request): Promise<Response> {
  let kind: MediaKind | null = null;
  try {
    const denied = requireAuth(request);
    if (denied) return denied;

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const requested = url.searchParams.get("kind");
    if (query.length < 2) return json({ error: "Type at least 2 characters." }, 400);
    if (!isKind(requested)) return json({ error: "Choose a movie, show, anime, or game." }, 400);
    kind = requested;

    const found = kind === "game" ? await searchGames(query) : await searchTitles(query, kind);
    if (!Array.isArray(found)) return json({ error: found.error }, found.status);
    return json({ results: found });
  } catch (error) {
    console.error("[api/media] GET failed", error);
    return json({ error: kind === "game" ? "Could not search SteamGridDB." : "Could not search TMDB." }, 500);
  }
}

function isKind(value: string | null): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}
