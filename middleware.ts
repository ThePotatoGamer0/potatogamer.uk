import { next } from "@vercel/functions";
import { buildOgDocument } from "./api/_lib/ogDocument.js";
import { applyOg, isOgPath } from "./shared/og.js";

export const config = {
  runtime: "nodejs",
  matcher: ["/", "/profile", "/activity", "/links", "/friends", "/interests", "/media", "/setup", "/homelab", "/guestbook"],
};

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if ((request.method !== "GET" && request.method !== "HEAD") || !isOgPath(url.pathname)) return next();

  try {
    const [doc, shell] = await Promise.all([
      buildOgDocument(request),
      fetch(new URL("/index.html", request.url), { signal: AbortSignal.timeout(4000) }),
    ]);
    if (!shell.ok) return next();
    const html = applyOg(await shell.text(), doc);
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[og] page tags failed", error instanceof Error ? error.message : "error");
    return next();
  }
}
