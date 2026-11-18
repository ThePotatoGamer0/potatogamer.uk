import { useEffect, useState, type FormEvent } from "react";
import { ICON_NAMES, SPEC_ICONS, normalizeConfig, type FriendConfig, type GuestbookEntry, type KvRow, type SiteConfig, type SiteLink, type SpecIcon, type SpecRow } from "../../shared/site";
import { useConfig } from "../context/AppProviders";
import { ApiError, api } from "../lib/api";
import { formatStamp } from "../lib/format";
import { clearAdminPassword, readAdminPassword, writeAdminPassword } from "../lib/session";
import { QuietState } from "../components/QuietState";
import { Toast, useToast } from "../components/Toast";

interface ConfigResponse {
  config: SiteConfig;
  storage: "kv" | "memory";
}

export function AdminPage() {
  const { setConfig, storage } = useConfig();
  const { toast, show } = useToast();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [draft, setDraft] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    const saved = readAdminPassword();
    if (!saved) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    api<ConfigResponse>("/api/config", { password: saved })
      .then((data) => {
        if (cancelled) return;
        setDraft(data.config);
        setConfig(data.config);
        setUnlocked(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearAdminPassword();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setConfig]);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    api<{ entries: GuestbookEntry[] }>("/api/guestbook")
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch((error: unknown) => {
        if (!cancelled) show("err", error instanceof Error ? error.message : "Could not load the guestbook.");
      });
    return () => {
      cancelled = true;
    };
  }, [show, unlocked]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (unlocking) return;
    setUnlocking(true);
    try {
      const data = await api<ConfigResponse>("/api/config", { password });
      writeAdminPassword(password);
      setDraft(data.config);
      setConfig(data.config);
      setUnlocked(true);
      setPassword("");
      show("ok", "Dashboard unlocked.");
    } catch (error) {
      show("err", error instanceof Error ? error.message : "Could not unlock.");
    } finally {
      setUnlocking(false);
    }
  }

  async function save() {
    if (!draft || saving) return;
    const normalized = normalizeConfig(draft, "write");
    if (!normalized.ok) {
      show("err", normalized.error);
      return;
    }
    const secret = readAdminPassword();
    setSaving(true);
    try {
      const data = await api<ConfigResponse>("/api/config", {
        method: "POST",
        password: secret,
        body: JSON.stringify(normalized.config),
      });
      setDraft(data.config);
      setConfig(data.config);
      show("ok", "Changes saved.");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 503)) {
        clearAdminPassword();
        setUnlocked(false);
      }
      show("err", error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    const secret = readAdminPassword();
    if (!secret) {
      setUnlocked(false);
      return;
    }
    try {
      await api("/api/guestbook", { method: "DELETE", password: secret, body: JSON.stringify({ id }) });
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setPendingDelete(null);
      show("ok", "Entry deleted.");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 503)) {
        clearAdminPassword();
        setUnlocked(false);
        setDraft(null);
      }
      show("err", error instanceof Error ? error.message : "Could not delete that entry.");
    }
  }

  function lock() {
    clearAdminPassword();
    setUnlocked(false);
    setDraft(null);
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <p className="kicker">Owner</p>
        <h1>Site settings</h1>
        <p className="lede">Edit the homepage from your phone. Nothing here is published until you save.</p>
      </header>

      {checking ? <section className="card"><p className="muted">Checking the saved session…</p></section> : null}

      {!checking && !unlocked ? (
        <section className="card lock-card">
          <h2>Unlock</h2>
          <p className="muted">Use the ADMIN_PASSWORD configured on the server.</p>
          <form className="stack" onSubmit={unlock}>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={unlocking}>
              {unlocking ? "Checking…" : "Unlock"}
            </button>
          </form>
        </section>
      ) : null}

      {!checking && unlocked && draft ? (
        <div className="admin-stack">
          {storage === "memory" ? (
            <p className="banner">Upstash isn’t connected. Saves stay in this server process until it restarts.</p>
          ) : null}

          <section className="card">
            <h2>Color</h2>
            <p className="muted">Auto uses your live Discord avatar. Manual keeps a color you choose.</p>
            <div className="theme-modes" role="group" aria-label="Color source">
              <button
                type="button"
                aria-pressed={draft.color.source === "auto"}
                onClick={() => setDraft({ ...draft, color: { ...draft.color, source: "auto" } })}
              >
                Auto
              </button>
              <button
                type="button"
                aria-pressed={draft.color.source === "manual"}
                onClick={() => setDraft({ ...draft, color: { ...draft.color, source: "manual" } })}
              >
                Manual
              </button>
            </div>
            {draft.color.source === "manual" ? (
              <label className="field color-field">
                <span>Seed color</span>
                <input
                  type="color"
                  value={draft.color.seed}
                  aria-label="Seed color"
                  onChange={(event) => setDraft({ ...draft, color: { source: "manual", seed: event.target.value } })}
                />
              </label>
            ) : null}
          </section>

          <section className="card">
            <h2>Fallback quote</h2>
            <p className="muted">Shown when Lanyard has no kv.quote.</p>
            <label className="field">
              <span className="sr">Fallback quote</span>
              <textarea
                rows={3}
                maxLength={280}
                value={draft.quote}
                onChange={(event) => setDraft({ ...draft, quote: event.target.value })}
              />
            </label>
          </section>

          <PairEditor
            title="Interests"
            description="Labels become the chips on the profile card."
            keyName="Label"
            valueName="Value"
            rows={draft.interests}
            onChange={(interests) => setDraft({ ...draft, interests })}
          />
          <SpecEditor
            title="PC setup"
            description="One device per row. Subtext sits under the spec, such as which OS is on a drive."
            name="PC setup"
            idPrefix="setup"
            rows={draft.setup}
            onChange={(setup) => setDraft({ ...draft, setup })}
          />
          <SpecEditor
            title="Homelab"
            description="Same layout as the PC card. Subtext sits under the spec, such as the OS on a drive."
            name="Homelab"
            idPrefix="homelab"
            rows={draft.homelab}
            onChange={(homelab) => setDraft({ ...draft, homelab })}
          />
          <LinkEditor links={draft.links} onChange={(links) => setDraft({ ...draft, links })} />
          <FriendEditor friends={draft.friends} onChange={(friends) => setDraft({ ...draft, friends })} />

          <section className="card">
            <h2>Guestbook</h2>
            <p className="muted">Notes on the homepage. Deleting one removes it for everyone.</p>
            {entries.length === 0 ? (
              <QuietState>No notes yet.</QuietState>
            ) : (
              <ol className="entries admin-entries">
                {entries.map((entry) => (
                  <li key={entry.id} className="entry">
                    <p className="entry-message">{entry.message}</p>
                    <div className="entry-meta">
                      <p className="signed">
                        Signed by <strong>{entry.username}</strong>
                        <time className="mono" dateTime={entry.createdAt}>
                          {formatStamp(entry.createdAt)}
                        </time>
                      </p>
                      {pendingDelete === entry.id ? (
                        <span className="confirm">
                          <button type="button" className="btn danger compact" onClick={() => void removeEntry(entry.id)}>
                            Delete
                          </button>
                          <button type="button" className="btn tonal compact" onClick={() => setPendingDelete(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn tonal compact" onClick={() => setPendingDelete(entry.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="savebar">
            <button type="button" className="btn tonal" onClick={lock}>
              Lock
            </button>
            <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
      <Toast toast={toast} />
    </div>
  );
}

function PairEditor({
  title,
  description,
  keyName,
  valueName,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  keyName: string;
  valueName: string;
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
}) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="btn tonal" onClick={() => onChange([...rows, { id: newId("row"), label: "", value: "" }])}>
          Add
        </button>
      </div>
      <div className="editor-list">
        {rows.map((row, index) => (
          <div key={row.id} className="editor-row">
            <label className="field">
              <span>{keyName}</span>
              <input
                value={row.label}
                aria-label={`${title} ${keyName} ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, label: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>{valueName}</span>
              <input
                value={row.value}
                aria-label={`${title} ${valueName} ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, value: event.target.value }))}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(rows, index, -1))}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={index === rows.length - 1}
                onClick={() => onChange(moveItem(rows, index, 1))}
              >
                ↓
              </button>
              <button type="button" className="icon-btn danger" aria-label="Remove" onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecEditor({
  title,
  description,
  name,
  idPrefix,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  name: string;
  idPrefix: string;
  rows: SpecRow[];
  onChange: (rows: SpecRow[]) => void;
}) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <button
          type="button"
          className="btn tonal"
          onClick={() => onChange([...rows, { id: newId(idPrefix), label: "", value: "", detail: "", icon: "cpu" }])}
        >
          Add
        </button>
      </div>
      <div className="editor-list">
        {rows.map((row, index) => (
          <div key={row.id} className="editor-row specs">
            <label className="field">
              <span>Icon</span>
              <select
                value={row.icon}
                aria-label={`${name} icon ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, icon: event.target.value as SpecIcon }))}
              >
                {SPEC_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Part</span>
              <input
                value={row.label}
                aria-label={`${name} part ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, label: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Spec</span>
              <input
                value={row.value}
                aria-label={`${name} spec ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, value: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Subtext</span>
              <input
                value={row.detail}
                aria-label={`${name} subtext ${index + 1}`}
                onChange={(event) => onChange(updateRow(rows, index, { ...row, detail: event.target.value }))}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(rows, index, -1))}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={index === rows.length - 1}
                onClick={() => onChange(moveItem(rows, index, 1))}
              >
                ↓
              </button>
              <button type="button" className="icon-btn danger" aria-label="Remove" onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinkEditor({ links, onChange }: { links: SiteLink[]; onChange: (links: SiteLink[]) => void }) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Links</h2>
          <p className="muted">Discord and GitHub are seeded. Add anything else here.</p>
        </div>
        <button
          type="button"
          className="btn tonal"
          onClick={() => onChange([...links, { id: newId("link"), title: "", handle: "", url: "", icon: "link" }])}
        >
          Add
        </button>
      </div>
      <div className="editor-list">
        {links.map((link, index) => (
          <div key={link.id} className="editor-row links">
            <label className="field">
              <span>Title</span>
              <input value={link.title} onChange={(event) => onChange(updateRow(links, index, { ...link, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Handle</span>
              <input value={link.handle} onChange={(event) => onChange(updateRow(links, index, { ...link, handle: event.target.value }))} />
            </label>
            <label className="field grow">
              <span>URL</span>
              <input
                type="url"
                inputMode="url"
                value={link.url}
                onChange={(event) => onChange(updateRow(links, index, { ...link, url: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Icon</span>
              <select value={link.icon} onChange={(event) => onChange(updateRow(links, index, { ...link, icon: event.target.value as SiteLink["icon"] }))}>
                {ICON_NAMES.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions">
              <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(links, index, -1))}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={index === links.length - 1}
                onClick={() => onChange(moveItem(links, index, 1))}
              >
                ↓
              </button>
              <button type="button" className="icon-btn danger" aria-label="Remove link" onClick={() => onChange(links.filter((item) => item.id !== link.id))}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FriendEditor({ friends, onChange }: { friends: FriendConfig[]; onChange: (friends: FriendConfig[]) => void }) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Friends</h2>
          <p className="muted">Discord user IDs. Their Lanyard kv.quote and kv.url show up on the friends card.</p>
        </div>
        <button type="button" className="btn tonal" onClick={() => onChange([...friends, { id: newId("friend"), discordId: "", label: "" }])}>
          Add
        </button>
      </div>
      <div className="editor-list">
        {friends.map((friend, index) => (
          <div key={friend.id} className="editor-row">
            <label className="field">
              <span>Discord ID</span>
              <input
                className="mono"
                inputMode="numeric"
                value={friend.discordId}
                onChange={(event) => onChange(updateRow(friends, index, { ...friend, discordId: event.target.value.trim() }))}
              />
            </label>
            <label className="field">
              <span>Label</span>
              <input
                value={friend.label}
                placeholder="Optional"
                onChange={(event) => onChange(updateRow(friends, index, { ...friend, label: event.target.value }))}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(friends, index, -1))}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={index === friends.length - 1}
                onClick={() => onChange(moveItem(friends, index, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Remove friend"
                onClick={() => onChange(friends.filter((item) => item.id !== friend.id))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function updateRow<T>(rows: T[], index: number, next: T): T[] {
  return rows.map((row, rowIndex) => (rowIndex === index ? next : row));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  if (!item) return items;
  next.splice(target, 0, item);
  return next;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
