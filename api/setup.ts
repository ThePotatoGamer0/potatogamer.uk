import { buildSetupConfig, passwordIssue } from "../shared/site.js";
import { requestHost } from "./_lib/host.js";
import { HttpError, json, readJson } from "./_lib/http.js";
import { hashPassword } from "./_lib/password.js";
import { claimPassword, deletePassword, readSite, storageMode, writeConfig } from "./_lib/store.js";

export async function POST(request: Request): Promise<Response> {
  const host = requestHost(request);
  try {
    const site = await readSite(host);
    if (!site.needsSetup) return json({ error: "This site is already set up." }, 409);

    const body = await readJson(request);
    if (!body || typeof body !== "object") return json({ error: "Body must be a JSON object." }, 400);
    const record = body as { password?: unknown; confirm?: unknown; name?: unknown; discordId?: unknown; siteName?: unknown; quote?: unknown };
    const password = typeof record.password === "string" ? record.password : "";
    const confirm = typeof record.confirm === "string" ? record.confirm : "";
    const issue = passwordIssue(password, confirm);
    if (issue) return json({ error: issue }, 400);

    const built = buildSetupConfig({
      name: record.name,
      discordId: record.discordId,
      siteName: record.siteName,
      quote: record.quote,
      siteNameFallback: host,
    });
    if (!built.ok) return json({ error: built.error }, 400);

    const claimed = await claimPassword(host, await hashPassword(password));
    if (!claimed) return json({ error: "This site is already set up." }, 409);
    try {
      await writeConfig(host, built.config);
    } catch (error) {
      await deletePassword(host).catch(() => undefined);
      throw error;
    }
    console.info("[api/setup] site claimed", host);
    return json({ ok: true, config: built.config, storage: storageMode(), needsSetup: false }, 201);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/setup] POST failed", error);
    return json({ error: "Could not finish setup." }, 500);
  }
}
