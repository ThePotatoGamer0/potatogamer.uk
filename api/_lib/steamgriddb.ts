import { remoteArt, type MediaKind } from "../../shared/site.js";

export interface GameChoice {
  tmdbId: number;
  kind: MediaKind;
  name: string;
  year: string;
  overview: string;
  poster: string;
  backdrop: string;
}

interface SgGame {
  id?: unknown;
  name?: unknown;
}

interface SgAsset {
  url?: unknown;
  style?: unknown;
  humor?: unknown;
  width?: unknown;
  height?: unknown;
  score?: unknown;
}

const ENDPOINT = "https://www.steamgriddb.com/api/v2";

export async function searchGames(query: string): Promise<GameChoice[] | { error: string; status: number }> {
  const key = process.env.STEAMGRIDDB_API_KEY?.trim() ?? "";
  if (!key) return { error: "SteamGridDB isn’t configured on the server.", status: 503 };

  try {
    const found = await sgdb<SgGame[]>(`/search/autocomplete/${encodeURIComponent(query)}`, key);
    const games = Array.isArray(found) ? found : [];
    const choices = await Promise.all(games.slice(0, 6).map((game) => artwork(game, key)));
    return choices.filter((choice): choice is GameChoice => choice !== null);
  } catch (error) {
    if (isStatus(error)) return { error: error.message, status: error.status };
    return { error: "Could not reach SteamGridDB.", status: 502 };
  }
}

async function artwork(game: SgGame, key: string): Promise<GameChoice | null> {
  if (typeof game.id !== "number" || !Number.isSafeInteger(game.id) || game.id < 1) return null;
  const name = typeof game.name === "string" ? game.name.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!name) return null;

  const query = "types=static&nsfw=false&humor=any";
  const [grids, heroes] = await Promise.all([
    sgdb<unknown>(`/grids/game/${game.id}?${query}`, key),
    sgdb<unknown>(`/heroes/game/${game.id}?${query}`, key),
  ]);

  const poster = best(grids, true);
  if (!poster) return null;
  return {
    tmdbId: game.id,
    kind: "game",
    name,
    year: "",
    overview: "",
    poster,
    backdrop: best(heroes, false),
  };
}

function best(assets: unknown, portrait: boolean): string {
  if (!Array.isArray(assets)) return "";
  let winner = "";
  let bestScore = -1;
  for (const asset of assets) {
    if (!asset || typeof asset !== "object") continue;
    const record = asset as SgAsset;
    const url = remoteArt(record.url);
    if (!url) continue;
    const humor = record.humor === true || record.style === "humor";
    const width = typeof record.width === "number" ? record.width : 0;
    const height = typeof record.height === "number" ? record.height : 0;
    let fit = 0.5;
    if (width > 0 && height > 0) {
      const ratio = width / height;
      const target = portrait ? 2 / 3 : 3;
      fit = 1 - Math.min(1, Math.abs(ratio - target) / target);
      if (portrait && height <= width) fit -= 0.5;
      if (!portrait && width <= height) fit -= 0.5;
    }
    const popularity = typeof record.score === "number" ? Math.min(Math.max(record.score, 0), 200) / 1000 : 0;
    const score = (humor ? 0 : 2) + fit + popularity;
    if (score > bestScore) {
      bestScore = score;
      winner = url;
    }
  }
  return winner;
}

async function sgdb<T>(path: string, key: string): Promise<T | null> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "User-Agent": "potatogamer.uk",
    },
  });
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) throw new StatusError(503, "SteamGridDB rejected the key.");
  if (response.status === 429) throw new StatusError(503, "SteamGridDB is rate limiting searches. Try again in a moment.");
  if (!response.ok) throw new StatusError(502, "Could not search SteamGridDB.");
  const body = (await response.json()) as { success?: unknown; data?: T };
  if (body.success !== true || body.data === undefined) return null;
  return body.data;
}

class StatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isStatus(error: unknown): error is StatusError {
  return error instanceof StatusError;
}
