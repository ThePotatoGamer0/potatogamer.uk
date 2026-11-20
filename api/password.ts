import { passwordIssue } from "../shared/site.js";
import { requestHost } from "./_lib/host.js";
import { HttpError, bearer, json, readJson, requireAuth } from "./_lib/http.js";
import { hashPassword } from "./_lib/password.js";
import { writePassword } from "./_lib/store.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const denied = await requireAuth(request);
    if (denied) return denied;
    const body = await readJson(request, 8_000);
    if (!body || typeof body !== "object") return json({ error: "Body must be a JSON object." }, 400);
    const record = body as { current?: unknown; next?: unknown; confirm?: unknown };
    const current = typeof record.current === "string" ? record.current : "";
    const next = typeof record.next === "string" ? record.next : "";
    const confirm = typeof record.confirm === "string" ? record.confirm : "";
    const session = bearer(request);
    if (!session || current !== session) return json({ error: "Wrong password." }, 401);
    const issue = passwordIssue(next, confirm);
    if (issue) return json({ error: issue }, 400);
    await writePassword(requestHost(request), await hashPassword(next));
    return json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/password] POST failed", error);
    return json({ error: "Could not change the password." }, 500);
  }
}
