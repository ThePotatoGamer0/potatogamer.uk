import { validateGuestbook, type GuestbookEntry } from "../shared/site.js";
import { HttpError, json, readJson, requireAuth } from "./_lib/http.js";
import { clientKey, readEntries, storageMode, takeRateLimit, writeEntries } from "./_lib/store.js";

const ENTRY_LIMIT = 100;

export async function GET(): Promise<Response> {
  try {
    const entries = await readEntries();
    return json({ entries, storage: storageMode() });
  } catch (error) {
    console.error("[api/guestbook] GET failed", error);
    return json({ error: "Could not load the guestbook." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request, 8_000);
    if (!body || typeof body !== "object") {
      return json({ error: "Body must be a JSON object." }, 400);
    }
    const record = body as { username?: unknown; message?: unknown; website?: unknown };
    const website = typeof record.website === "string" ? record.website.trim() : "";
    const key = clientKey(request);

    if (website) {
      await takeRateLimit(key);
      return json({ ok: true });
    }

    const validated = validateGuestbook({ username: record.username, message: record.message });
    if (!validated.ok) return json({ error: validated.error }, 400);

    const allowed = await takeRateLimit(key);
    if (!allowed) {
      return json({ error: "Slow down — one note every 30 seconds." }, 429, { "Retry-After": "30" });
    }

    const entry: GuestbookEntry = {
      id: crypto.randomUUID(),
      username: validated.username,
      message: validated.message,
      createdAt: new Date().toISOString(),
    };
    const current = await readEntries();
    await writeEntries([entry, ...current].slice(0, ENTRY_LIMIT));
    console.info("[api/guestbook] entry created");
    return json({ ok: true, entry }, 201);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/guestbook] POST failed", error);
    return json({ error: "Could not sign the guestbook." }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const denied = requireAuth(request);
    if (denied) return denied;
    const url = new URL(request.url);
    let id = url.searchParams.get("id") ?? "";
    if (!id) {
      const body = await readJson(request, 4_000);
      if (body && typeof body === "object" && "id" in body) {
        const candidate = (body as { id?: unknown }).id;
        id = typeof candidate === "string" ? candidate : "";
      }
    }
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return json({ error: "Missing guestbook entry id." }, 400);
    const current = await readEntries();
    const next = current.filter((entry) => entry.id !== id);
    if (next.length === current.length) return json({ error: "Entry not found." }, 404);
    await writeEntries(next);
    console.info("[api/guestbook] entry deleted");
    return json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api/guestbook] DELETE failed", error);
    return json({ error: "Could not delete that entry." }, 500);
  }
}
