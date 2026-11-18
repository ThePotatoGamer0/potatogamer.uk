import { normalizeConfig } from "../shared/site";
import { HttpError, json, readJson, requireAuth } from "./_lib/http";
import { readConfig, storageMode, writeConfig } from "./_lib/store";

export async function GET(request: Request): Promise<Response> {
  try {
    if (request.headers.get("authorization")) {
      const denied = requireAuth(request);
      if (denied) return denied;
    }
    const config = await readConfig();
    return json({ config, storage: storageMode(), authorized: Boolean(request.headers.get("authorization")) });
  } catch (error) {
    console.error("[api/config] GET failed", error);
    return json({ error: "Could not load site config." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const denied = requireAuth(request);
    if (denied) return denied;
    const body = await readJson(request);
    const normalized = normalizeConfig(body, "write");
    if (!normalized.ok) return json({ error: normalized.error }, 400);
    await writeConfig(normalized.config);
    console.info("[api/config] config saved");
    return json({ ok: true, config: normalized.config, storage: storageMode() });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/config] POST failed", error);
    return json({ error: "Could not save site config." }, 500);
  }
}
