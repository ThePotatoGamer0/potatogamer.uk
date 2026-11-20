import { timingSafeEqual } from "node:crypto";
import { isPrimaryHost, requestHost } from "./host.js";
import { verifyPassword } from "./password.js";
import { readPassword } from "./store.js";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

export async function readJson(request: Request, max = 100_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, "Payload is too large.");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Body must be JSON.");
  }
}

function safeEqual(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S.*)$/i.exec(header);
  return match ? match[1] : null;
}

export async function authorized(request: Request): Promise<boolean> {
  const host = requestHost(request);
  const given = bearer(request);
  const record = await readPassword(host);
  if (record) {
    if (!given) return false;
    return verifyPassword(given, record);
  }
  if (!isPrimaryHost(host)) return false;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !given) return false;
  return safeEqual(given, expected);
}

export async function passwordConfigured(request: Request): Promise<boolean> {
  const host = requestHost(request);
  if (await readPassword(host)) return true;
  return isPrimaryHost(host) && Boolean(process.env.ADMIN_PASSWORD);
}

export async function requireAuth(request: Request): Promise<Response | null> {
  if (!(await passwordConfigured(request))) {
    return json({ error: "No password is set up." }, 503);
  }
  if (!(await authorized(request))) return json({ error: "Wrong password." }, 401);
  return null;
}
