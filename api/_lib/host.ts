export function normalizeHost(value: string): string {
  const withoutPort = value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const bare = withoutPort.startsWith("www.") ? withoutPort.slice(4) : withoutPort;
  if (!bare || !/^[a-z0-9.-]+$/.test(bare)) return "localhost";
  return bare;
}

export function requestHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const raw = (forwarded ?? request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  return normalizeHost(raw);
}

export function primaryHost(): string | null {
  const raw = process.env.PRIMARY_HOST?.trim() ?? "";
  if (!raw) return null;
  return normalizeHost(raw);
}

export function isPrimaryHost(host: string): boolean {
  const primary = primaryHost();
  return primary !== null && host === primary;
}
