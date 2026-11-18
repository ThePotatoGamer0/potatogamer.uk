import { timingSafeEqual } from "node:crypto";

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

export function passwordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S.*)$/i.exec(header);
  if (!match) return false;
  return safeEqual(match[1], expected);
}

export function requireAuth(request: Request): Response | null {
  if (!passwordConfigured()) {
    return json({ error: "ADMIN_PASSWORD is not configured on the server." }, 503);
  }
  if (!authorized(request)) return json({ error: "Wrong password." }, 401);
  return null;
}
