import { Redis } from "@upstash/redis";

const SNOWFLAKE = /^\d{17,20}$/;
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";
const GUILDS = 1 << 0;
const GUILD_PRESENCES = 1 << 8;
const CACHE_KEY = "discord:statuses";
const FRESH_SECONDS = 120;
const INTENT_SECONDS = 600;
const GUILD_LIMIT = 50;
const USER_LIMIT = 100;

export interface BotStatus {
  status: "online" | "idle" | "dnd" | "offline";
  activity: string;
}

interface StatusCache {
  ids: string;
  statuses: Record<string, BotStatus>;
}

interface MemoryCache extends StatusCache {
  expires: number;
}

let memoryCache: MemoryCache | null = null;
const inflight = new Map<string, Promise<Record<string, BotStatus>>>();
let loggedIntent = false;

export async function loadStatuses(ids: string[], token: string): Promise<Record<string, BotStatus>> {
  const wanted = [...new Set(ids.filter((id) => SNOWFLAKE.test(id)))].slice(0, USER_LIMIT).sort();
  if (wanted.length === 0 || !token) return {};
  const key = wanted.join(",");
  const cached = await readCache(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = fetchStatuses(wanted, token, key).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
}

async function fetchStatuses(ids: string[], token: string, key: string): Promise<Record<string, BotStatus>> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim() ?? "";
  const result = await watchGateway(token, ids, SNOWFLAKE.test(guildId) ? guildId : "");
  await writeCache({ ids: key, statuses: result.statuses }, result.holdSeconds);
  return result.statuses;
}

async function watchGateway(
  token: string,
  userIds: string[],
  guildFilter: string,
): Promise<{ statuses: Record<string, BotStatus>; holdSeconds: number }> {
  if (typeof WebSocket === "undefined") {
    console.error("[api/discord] This runtime has no WebSocket client, so CatTag cannot read status.");
    return { statuses: {}, holdSeconds: INTENT_SECONDS };
  }

  return new Promise((resolve) => {
    const statuses: Record<string, BotStatus> = {};
    const pending = new Set<string>();
    const requested = new Set<string>();
    let sequence: number | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    let holdSeconds = FRESH_SECONDS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const socket = new WebSocket(GATEWAY);

    const finish = (code?: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      if (code === 4014 || code === 4004) holdSeconds = INTENT_SECONDS;
      resolve({ statuses, holdSeconds });
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    };

    timer = setTimeout(() => {
      holdSeconds = 30;
      finish();
    }, 10000);

    const send = (payload: unknown) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    };

    socket.addEventListener("message", (event) => {
      let packet: { op?: number; t?: string; s?: number | null; d?: unknown };
      try {
        packet = JSON.parse(String(event.data)) as typeof packet;
      } catch {
        return;
      }
      if (typeof packet.s === "number") sequence = packet.s;

      if (packet.op === 1) {
        send({ op: 1, d: sequence });
        return;
      }
      if (packet.op === 7 || packet.op === 9) {
        finish();
        return;
      }
      if (packet.op === 10) {
        const interval = intervalOf(packet.d);
        heartbeat = setInterval(() => send({ op: 1, d: sequence }), interval);
        send({
          op: 2,
          d: {
            token,
            intents: GUILDS | GUILD_PRESENCES,
            large_threshold: 250,
            properties: { os: "linux", browser: "potatogamer.uk", device: "potatogamer.uk" },
          },
        });
        return;
      }
      if (packet.op !== 0 || !packet.d || typeof packet.d !== "object") return;

      if (packet.t === "READY") {
        const guilds = guildIds(packet.d, guildFilter);
        for (const id of guilds) pending.add(id);
        if (pending.size === 0) finish();
        return;
      }

      if (packet.t === "GUILD_CREATE") {
        const record = packet.d as { id?: unknown; unavailable?: unknown };
        const guildId = typeof record.id === "string" ? record.id : "";
        if (!pending.has(guildId) || requested.has(guildId)) return;
        if (record.unavailable === true) {
          pending.delete(guildId);
          if (pending.size === 0) finish();
          return;
        }
        absorb(packet.d, userIds, statuses);
        requested.add(guildId);
        send({
          op: 8,
          d: {
            guild_id: guildId,
            user_ids: userIds,
            presences: true,
            nonce: `s${guildId.slice(-8)}`,
          },
        });
        return;
      }

      if (packet.t === "GUILD_MEMBERS_CHUNK") {
        absorb(packet.d, userIds, statuses);
        const record = packet.d as { guild_id?: unknown; chunk_index?: unknown; chunk_count?: unknown };
        const guildId = typeof record.guild_id === "string" ? record.guild_id : "";
        const count = typeof record.chunk_count === "number" ? record.chunk_count : 1;
        const index = typeof record.chunk_index === "number" ? record.chunk_index : 0;
        if (index + 1 >= count) pending.delete(guildId);
        if (pending.size === 0) finish();
      }
    });

    socket.addEventListener("close", (event) => {
      if (event.code === 4014 && !loggedIntent) {
        loggedIntent = true;
        console.error("[api/discord] CatTag needs the Presence Intent enabled in the Discord developer portal.");
      } else if (event.code === 4004) {
        console.error("[api/discord] Discord rejected the bot token.");
      }
      finish(event.code);
    });
    socket.addEventListener("error", () => {
      holdSeconds = 30;
      finish();
    });
  });
}

function absorb(value: unknown, userIds: string[], statuses: Record<string, BotStatus>) {
  if (!value || typeof value !== "object") return;
  const record = value as { members?: unknown; presences?: unknown };
  const wanted = new Set(userIds);
  if (!Array.isArray(record.presences) && !Array.isArray(record.members)) return;
  const seen = new Set<string>();
  for (const presence of Array.isArray(record.presences) ? record.presences : []) {
    const parsed = presenceStatus(presence);
    if (!parsed || !wanted.has(parsed.id)) continue;
    seen.add(parsed.id);
    statuses[parsed.id] = prefer(statuses[parsed.id], parsed.status);
  }
  if (!Array.isArray(record.members)) return;
  for (const member of record.members) {
    const id = memberId(member);
    if (!id || !wanted.has(id) || seen.has(id)) continue;
    statuses[id] = prefer(statuses[id], { status: "offline", activity: "" });
  }
}

function presenceStatus(value: unknown): { id: string; status: BotStatus } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { user?: unknown; status?: unknown; activities?: unknown };
  const id = memberId(record.user);
  const status = normalizeStatus(record.status);
  if (!id || !status) return null;
  return { id, status: { status, activity: activityLabel(record.activities) } };
}

function prefer(current: BotStatus | undefined, next: BotStatus): BotStatus {
  if (!current || current.status === "offline") return next;
  if (next.status === "offline") return current;
  if (!current.activity && next.activity) return next;
  return current;
}

function activityLabel(value: unknown): string {
  if (!Array.isArray(value)) return "";
  for (const activity of value) {
    const label = namedActivity(activity);
    if (label) return label;
  }
  for (const activity of value) {
    if (!activity || typeof activity !== "object" || (activity as { type?: unknown }).type !== 4) continue;
    const state = cleanText((activity as { state?: unknown }).state, 80);
    if (state) return state;
  }
  return "";
}

function namedActivity(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as { type?: unknown; name?: unknown; details?: unknown };
  const name = cleanText(record.name, 60);
  const details = cleanText(record.details, 60);
  if (record.type === 0 && name) return clip(`Playing ${name}`);
  if (record.type === 1 && (details || name)) return clip(`Streaming ${details || name}`);
  if (record.type === 2 && (details || name)) return clip(`Listening to ${details || name}`);
  if (record.type === 3 && name) return clip(`Watching ${name}`);
  if (record.type === 5 && name) return clip(`Competing in ${name}`);
  return "";
}

function memberId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as { id?: unknown; user?: unknown };
  if (typeof record.id === "string" && SNOWFLAKE.test(record.id)) return record.id;
  const user = record.user;
  if (!user || typeof user !== "object") return "";
  const nested = (user as { id?: unknown }).id;
  return typeof nested === "string" && SNOWFLAKE.test(nested) ? nested : "";
}

function normalizeStatus(value: unknown): BotStatus["status"] | null {
  if (value === "online" || value === "idle" || value === "dnd" || value === "offline") return value;
  if (value === "invisible") return "offline";
  return null;
}

function guildIds(value: object, guildFilter: string): string[] {
  const guilds = (value as { guilds?: unknown }).guilds;
  if (!Array.isArray(guilds)) return [];
  const ids = guilds
    .map((guild) => (guild && typeof guild === "object" ? (guild as { id?: unknown }).id : ""))
    .filter((id): id is string => typeof id === "string" && SNOWFLAKE.test(id));
  const chosen = guildFilter ? ids.filter((id) => id === guildFilter) : ids;
  return chosen.slice(0, GUILD_LIMIT);
}

function intervalOf(value: unknown): number {
  const interval =
    value && typeof value === "object" ? (value as { heartbeat_interval?: unknown }).heartbeat_interval : 0;
  return typeof interval === "number" && interval >= 1000 ? interval : 41250;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function clip(value: string): string {
  return value.length > 80 ? `${value.slice(0, 79).trimEnd()}…` : value;
}

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readCache(ids: string): Promise<Record<string, BotStatus> | null> {
  if (memoryCache && memoryCache.ids === ids && memoryCache.expires > Date.now()) return memoryCache.statuses;
  const client = redis();
  if (!client) return null;
  try {
    const raw = await client.get<StatusCache>(CACHE_KEY);
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as StatusCache) : raw;
    if (!parsed || parsed.ids !== ids || !parsed.statuses || typeof parsed.statuses !== "object") return null;
    memoryCache = { ...parsed, expires: Date.now() + FRESH_SECONDS * 1000 };
    return parsed.statuses;
  } catch (error) {
    console.error("[api/discord] status cache read failed", error instanceof Error ? error.message : "error");
    return null;
  }
}

async function writeCache(value: StatusCache, seconds: number): Promise<void> {
  memoryCache = { ...value, expires: Date.now() + seconds * 1000 };
  const client = redis();
  if (!client) return;
  try {
    await client.set(CACHE_KEY, value, { ex: seconds });
  } catch (error) {
    console.error("[api/discord] status cache write failed", error instanceof Error ? error.message : "error");
  }
}
