export const OG_CARDS = {
  profile: { kicker: "Profile", heading: "Profile" },
  activity: { kicker: "Live activity", heading: "Right now" },
  links: { kicker: "Links", heading: "Find me" },
  friends: { kicker: "Friends", heading: "People" },
  interests: { kicker: "Interests", heading: "Interests" },
  media: { kicker: "Media", heading: "On rotation" },
  setup: { kicker: "PC setup", heading: "Setup" },
  homelab: { kicker: "Homelab", heading: "Homelab" },
  guestbook: { kicker: "Guestbook", heading: "Leave a note" },
} as const;

export type OgCard = keyof typeof OG_CARDS;

export type OgLayout = "profile" | "rows" | "tiles" | "media" | "specs" | "activity";

export interface OgItem {
  label: string;
  detail: string;
  image: string | null;
  mark: string | null;
}

export interface OgDocument {
  card: OgCard | null;
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lede: string;
  lines: string[];
  items: OgItem[];
  layout: OgLayout;
  url: string;
  image: string;
  accent: string;
  picture: string | null;
  pictureKind: "avatar" | "poster" | null;
  siteName: string;
}

const MARKS = new Set(['"', "“", "”", "„", "«", "»"]);

export function isOgCard(value: string): value is OgCard {
  return Object.prototype.hasOwnProperty.call(OG_CARDS, value);
}

export function cardFromPath(pathname: string): OgCard | undefined {
  const path = stripSlash(pathname);
  if (!path.startsWith("/")) return undefined;
  const slug = path.slice(1).toLowerCase();
  if (!slug || slug.includes("/")) return undefined;
  return isOgCard(slug) ? slug : undefined;
}

export function cardFromQuery(value: string | null): OgCard | undefined {
  if (!value) return undefined;
  const slug = value.trim().toLowerCase();
  return isOgCard(slug) ? slug : undefined;
}

export function cardFromHash(hash: string): OgCard | undefined {
  const slug = hash.replace(/^#/, "").trim().toLowerCase();
  return isOgCard(slug) ? slug : undefined;
}

export function isOgPath(pathname: string): boolean {
  const path = stripSlash(pathname);
  return path === "/" || cardFromPath(path) !== undefined;
}

export function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const sliced = text.slice(0, Math.max(0, max - 3));
  const breakAt = Math.max(sliced.lastIndexOf(" · "), sliced.lastIndexOf(" "));
  const trimmed = (breakAt > max * 0.55 ? sliced.slice(0, breakAt) : sliced).trimEnd();
  return `${trimmed}...`;
}

export function spoken(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const wrapped = text.length > 1 && MARKS.has(text[0]) && MARKS.has(text.at(-1) ?? "");
  return wrapped ? text : `“${text}”`;
}

export function contentStamp(parts: readonly string[]): string {
  let hash = 2166136261;
  const text = parts.join("\n");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function applyOg(html: string, doc: OgDocument): string {
  const block = renderOgBlock(doc);
  const withBlock = html.includes("<!-- og:start -->")
    ? html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->/, block)
    : html.replace("</head>", `${block}\n</head>`);
  return withBlock
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(doc.title)}</title>`)
    .replace(/<meta\s[^>]*name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(doc.description)}" />`);
}

function renderOgBlock(doc: OgDocument): string {
  const title = escapeHtml(doc.title);
  const description = escapeHtml(doc.description);
  const url = escapeHtml(doc.url);
  const image = escapeHtml(doc.image);
  return `<!-- og:start -->
    <meta property="og:site_name" content="${escapeHtml(doc.siteName)}" />
    <meta property="og:locale" content="en_GB" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="canonical" href="${url}" />
    <!-- og:end -->`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}
