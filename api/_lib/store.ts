import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  defaultConfig,
  normalizeConfig,
  type GuestbookEntry,
  type SiteConfig,
  type StorageMode,
} from "../../shared/site";

const CONFIG_KEY = "site:config";
const GUESTBOOK_KEY = "guestbook:entries";
const ENTRY_LIMIT = 100;
const RATE_WINDOW_SECONDS = 30;

interface MemoryStore {
  config: SiteConfig | null;
  entries: GuestbookEntry[];
  limits: Map<string, number>;
}

function memory(): MemoryStore {
  const root = globalThis as typeof globalThis & { __potatogamerStore?: MemoryStore };
  if (!root.__potatogamerStore) {
    root.__potatogamerStore = { config: null, entries: [], limits: new Map() };
  }
  return root.__potatogamerStore;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function storageMode(): StorageMode {
  return getRedis() ? "kv" : "memory";
}

function asObject(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

export async function readConfig(): Promise<SiteConfig> {
  const redis = getRedis();
  const raw = redis ? await redis.get(CONFIG_KEY) : memory().config;
  if (raw == null) return defaultConfig;
  const parsed = normalizeConfig(asObject(raw), "read");
  return parsed.ok ? parsed.config : defaultConfig;
}

export async function writeConfig(config: SiteConfig): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().config = config;
    return;
  }
  await redis.set(CONFIG_KEY, config);
}

export async function readEntries(): Promise<GuestbookEntry[]> {
  const redis = getRedis();
  if (!redis) return memory().entries.slice();
  const raw = await redis.get(GUESTBOOK_KEY);
  const value = asObject(raw);
  if (!Array.isArray(value)) return [];
  return value.filter(isEntry).slice(0, ENTRY_LIMIT);
}

export async function writeEntries(entries: GuestbookEntry[]): Promise<void> {
  const next = entries.slice(0, ENTRY_LIMIT);
  const redis = getRedis();
  if (!redis) {
    memory().entries = next;
    return;
  }
  await redis.set(GUESTBOOK_KEY, next);
}

function isEntry(value: unknown): value is GuestbookEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<GuestbookEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.username === "string" &&
    typeof entry.message === "string" &&
    typeof entry.createdAt === "string"
  );
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`pg-guestbook:${ip}`).digest("hex");
}

/** Returns true when the caller is allowed to post. */
export async function takeRateLimit(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    const store = memory();
    const now = Date.now();
    const until = store.limits.get(key) ?? 0;
    if (until > now) return false;
    store.limits.set(key, now + RATE_WINDOW_SECONDS * 1000);
    if (store.limits.size > 1000) {
      for (const [id, expiry] of store.limits) {
        if (expiry <= now) store.limits.delete(id);
      }
    }
    return true;
  }

  const redisKey = `guestbook:rl:${key}`;
  const created = await redis.set(redisKey, "1", { nx: true, ex: RATE_WINDOW_SECONDS });
  return created !== null;
}
