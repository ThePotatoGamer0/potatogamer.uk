import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  defaultConfig,
  normalizeConfig,
  type GuestbookEntry,
  type SiteConfig,
  type StorageMode,
} from "../../shared/site.js";
import { isPrimaryHost, requestHost } from "./host.js";
import type { PasswordRecord } from "./password.js";

const LEGACY_CONFIG_KEY = "site:config";
const LEGACY_GUESTBOOK_KEY = "guestbook:entries";
const ENTRY_LIMIT = 100;
const RATE_WINDOW_SECONDS = 30;

interface MemoryStore {
  configs: Map<string, SiteConfig>;
  entries: Map<string, GuestbookEntry[]>;
  passwords: Map<string, PasswordRecord>;
  limits: Map<string, number>;
}

function memory(): MemoryStore {
  const root = globalThis as typeof globalThis & { __siteStore?: MemoryStore };
  if (!root.__siteStore?.configs) {
    root.__siteStore = { configs: new Map(), entries: new Map(), passwords: new Map(), limits: new Map() };
  }
  return root.__siteStore;
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

function configKey(host: string): string {
  return `site:config:${host}`;
}

function guestbookKey(host: string): string {
  return `guestbook:entries:${host}`;
}

function adminKey(host: string): string {
  return `site:admin:${host}`;
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

function asPassword(value: unknown): PasswordRecord | null {
  const record = asObject(value);
  if (!record || typeof record !== "object") return null;
  const salt = (record as Partial<PasswordRecord>).salt;
  const hash = (record as Partial<PasswordRecord>).hash;
  if (typeof salt !== "string" || typeof hash !== "string" || !salt || !hash) return null;
  return { salt, hash };
}

async function migrateLegacy(host: string, redis: Redis): Promise<void> {
  if (!isPrimaryHost(host)) return;
  const existing = await redis.get(configKey(host));
  if (existing != null) return;
  const legacy = await redis.get(LEGACY_CONFIG_KEY);
  if (legacy == null) return;
  await redis.set(configKey(host), legacy);
  const guest = await redis.get(guestbookKey(host));
  if (guest != null) return;
  const legacyGuest = await redis.get(LEGACY_GUESTBOOK_KEY);
  if (legacyGuest != null) await redis.set(guestbookKey(host), legacyGuest);
}

export async function readSite(host: string): Promise<{ config: SiteConfig; needsSetup: boolean }> {
  const redis = getRedis();
  if (!redis) {
    const stored = memory().configs.get(host);
    if (!stored) return { config: defaultConfig, needsSetup: true };
    const parsed = normalizeConfig(stored, "read");
    return { config: parsed.ok ? parsed.config : defaultConfig, needsSetup: false };
  }
  await migrateLegacy(host, redis);
  const raw = await redis.get(configKey(host));
  if (raw == null) return { config: defaultConfig, needsSetup: true };
  const parsed = normalizeConfig(asObject(raw), "read");
  return { config: parsed.ok ? parsed.config : defaultConfig, needsSetup: false };
}

export async function writeConfig(host: string, config: SiteConfig): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().configs.set(host, config);
    return;
  }
  await redis.set(configKey(host), config);
}

export async function readEntries(host: string): Promise<GuestbookEntry[]> {
  const redis = getRedis();
  if (!redis) return (memory().entries.get(host) ?? []).slice();
  const raw = await redis.get(guestbookKey(host));
  const value = asObject(raw);
  if (!Array.isArray(value)) return [];
  return value.filter(isEntry).slice(0, ENTRY_LIMIT);
}

export async function writeEntries(host: string, entries: GuestbookEntry[]): Promise<void> {
  const next = entries.slice(0, ENTRY_LIMIT);
  const redis = getRedis();
  if (!redis) {
    memory().entries.set(host, next);
    return;
  }
  await redis.set(guestbookKey(host), next);
}

export async function readPassword(host: string): Promise<PasswordRecord | null> {
  const redis = getRedis();
  if (!redis) return memory().passwords.get(host) ?? null;
  return asPassword(await redis.get(adminKey(host)));
}

export async function writePassword(host: string, record: PasswordRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().passwords.set(host, record);
    return;
  }
  await redis.set(adminKey(host), record);
}

/** Returns true when this domain did not already have a password. */
export async function claimPassword(host: string, record: PasswordRecord): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    const store = memory();
    if (store.passwords.has(host)) return false;
    store.passwords.set(host, record);
    return true;
  }
  const created = await redis.set(adminKey(host), record, { nx: true });
  return created !== null;
}

export async function deletePassword(host: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().passwords.delete(host);
    return;
  }
  await redis.del(adminKey(host));
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
  const host = requestHost(request);
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`guestbook:${host}:${ip}`).digest("hex");
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
