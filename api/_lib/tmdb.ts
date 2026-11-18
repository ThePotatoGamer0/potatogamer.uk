import type { MediaKind } from "../../shared/site.js";

type TitleKind = Exclude<MediaKind, "game">;

export interface TmdbChoice {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: string;
  overview: string;
  poster: string;
  backdrop: string;
}

export async function searchTitles(query: string, kind: TitleKind): Promise<TmdbChoice[] | { error: string; status: number }> {
  const key = process.env.TMDB_API_KEY?.trim() ?? "";
  if (!key) return { error: "TMDB isn’t configured on the server.", status: 503 };

  const endpoints = kind === "anime" ? (["tv", "movie"] as const) : kind === "movie" ? (["movie"] as const) : (["tv"] as const);
  const batches = await Promise.all(endpoints.map((endpoint) => searchEndpoint(endpoint, query, key)));
  const hits: TmdbHit[] = [];
  for (const batch of batches) {
    if (!Array.isArray(batch)) return batch;
    hits.push(...batch);
  }
  const ordered = kind === "anime" ? [...hits].sort((left, right) => score(right) - score(left)) : hits;
  return ordered.slice(0, 8).flatMap((hit) => {
    const choice = toChoice(hit, kind);
    return choice ? [choice] : [];
  });
}

async function searchEndpoint(endpoint: "movie" | "tv", query: string, key: string): Promise<TmdbHit[] | { error: string; status: number }> {
  const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  const bearer = key.startsWith("eyJ");
  if (!bearer) url.searchParams.set("api_key", key);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "potatogamer.uk (https://potatogamer.uk)",
        ...(bearer ? { Authorization: `Bearer ${key}` } : {}),
      },
      redirect: "manual",
    });
  } catch {
    console.error("[tmdb] search failed", endpoint);
    return { error: "TMDB could not be reached.", status: 502 };
  }

  if (!response.ok) {
    console.error("[tmdb] search rejected", response.status, endpoint);
    return { error: "TMDB rejected the search.", status: 502 };
  }

  const body = (await response.json().catch(() => null)) as { results?: TmdbHit[] } | null;
  return body?.results ?? [];
}

interface TmdbHit {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
}

function toChoice(hit: TmdbHit, kind: TitleKind): TmdbChoice | null {
  if (typeof hit.id !== "number" || !Number.isSafeInteger(hit.id) || hit.id < 1) return null;
  const name = clean(hit.title || hit.name);
  if (!name) return null;
  const dated = hit.release_date || hit.first_air_date;
  return {
    tmdbId: hit.id,
    kind,
    name: name.slice(0, 120),
    year: typeof dated === "string" ? dated.slice(0, 4).replace(/\D/g, "") : "",
    overview: clean(hit.overview).slice(0, 180),
    poster: path(hit.poster_path),
    backdrop: path(hit.backdrop_path),
  };
}

function score(hit: TmdbHit): number {
  const animated = hit.genre_ids?.includes(16) ? 1 : 0;
  const japanese = hit.original_language === "ja" ? 1 : 0;
  return animated + japanese;
}

function path(value: unknown): string {
  return typeof value === "string" && /^\/[A-Za-z0-9._/-]+$/.test(value) ? value : "";
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
