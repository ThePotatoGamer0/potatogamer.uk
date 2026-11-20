const HOME_DOMAIN = "potatogamer.uk";

export function externalDestination(href: string, currentHost: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = bareHost(url.hostname);
  if (belongsTo(host, HOME_DOMAIN) || belongsTo(host, bareHost(currentHost))) return null;
  return url.toString();
}

function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function belongsTo(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
