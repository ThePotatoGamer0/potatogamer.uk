import { buildOgDocument } from "./_lib/ogDocument.js";
import { renderOgImage } from "./_lib/ogImage.mjs";

export async function GET(request: Request): Promise<Response> {
  try {
    const doc = await buildOgDocument(request);
    const body = await renderOgImage(doc);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[api/og] GET failed", error instanceof Error ? error.message : "error");
    return new Response("Could not render that preview.", { status: 500 });
  }
}
