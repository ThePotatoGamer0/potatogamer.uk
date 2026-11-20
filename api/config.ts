import { normalizeConfig } from "../shared/site.js";
import { requestHost } from "./_lib/host.js";
import { HttpError, json, readJson, requireAuth } from "./_lib/http.js";
import { readSite, storageMode, writeConfig } from "./_lib/store.js";

export async function GET(request: Request): Promise<Response> {
  try {
    if (request.headers.get("authorization")) {
      const denied = await requireAuth(request);
      if (denied) return denied;
    }
    const host = requestHost(request);
    const site = await readSite(host);
    return json({
      config: site.config,
      storage: storageMode(),
      needsSetup: site.needsSetup,
      authorized: Boolean(request.headers.get("authorization")),
    });
  } catch (error) {
    console.error("[api/config] GET failed", error);
    return json({ error: "Could not load site config." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const host = requestHost(request);
    const site = await readSite(host);
    if (site.needsSetup) return json({ error: "Finish setup before saving." }, 409);
    const denied = await requireAuth(request);
    if (denied) return denied;
    const body = await readJson(request);
    const normalized = normalizeConfig(body, "write");
    if (!normalized.ok) return json({ error: normalized.error }, 400);
    await writeConfig(host, normalized.config);
    console.info("[api/config] config saved", host);
    return json({ ok: true, config: normalized.config, storage: storageMode(), needsSetup: false });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/config] POST failed", error);
    return json({ error: "Could not save site config." }, 500);
  }
}
