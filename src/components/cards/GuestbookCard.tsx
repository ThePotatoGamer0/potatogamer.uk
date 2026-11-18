import { useEffect, useState, type FormEvent } from "react";
import { USERNAME_PATTERN, type GuestbookEntry } from "../../../shared/site";
import { api } from "../../lib/api";
import { formatStamp } from "../../lib/format";
import { readGuestName, writeGuestName } from "../../lib/session";
import { QuietState } from "../QuietState";
import { Toast, useToast } from "../Toast";

interface GuestbookResponse {
  entries: GuestbookEntry[];
}

export function GuestbookCard() {
  const { toast, show } = useToast();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const saved = readGuestName();
    if (saved && USERNAME_PATTERN.test(saved)) {
      setUsername(saved);
      setLocked(true);
    }
    let cancelled = false;
    api<GuestbookResponse>("/api/guestbook")
      .then((data) => {
        if (!cancelled) setEntries(sortEntries(data.entries));
      })
      .catch((error: unknown) => {
        if (!cancelled) show("err", error instanceof Error ? error.message : "Could not load the guestbook.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting) return;
    if (!USERNAME_PATTERN.test(username)) {
      show("err", "Username must be 3–20 letters, numbers, or underscores.");
      return;
    }
    const note = message.trim();
    if (!note || note.length > 200) {
      show("err", "Message must be 1–200 characters.");
      return;
    }
    setPosting(true);
    try {
      const data = await api<{ ok: true; entry?: GuestbookEntry }>("/api/guestbook", {
        method: "POST",
        body: JSON.stringify({ username, message: note, website }),
      });
      if (!locked) {
        writeGuestName(username);
        setLocked(true);
      }
      setMessage("");
      setWebsite("");
      if (data.entry) setEntries((current) => sortEntries([data.entry!, ...current]));
      show("ok", "Signed the guestbook.");
    } catch (error) {
      show("err", error instanceof Error ? error.message : "Could not sign the guestbook.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="card guestbook">
      <p className="kicker">Guestbook</p>
      <h2>Leave a note</h2>
      <form className="guest-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Username</span>
          <input
            name="guest-username"
            autoComplete="off"
            spellCheck={false}
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            value={username}
            disabled={locked}
            required
            onChange={(event) => setUsername(event.target.value)}
          />
          {locked ? <small>Saved in this browser after your first note.</small> : null}
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            name="message"
            maxLength={200}
            rows={3}
            value={message}
            required
            onChange={(event) => setMessage(event.target.value.slice(0, 200))}
          />
          <small className="mono counter">{message.trim().length}/200</small>
        </label>
        <div className="hp" aria-hidden="true">
          <label>
            Website
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              data-1p-ignore="true"
              data-lpignore="true"
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
        </div>
        <button className="btn" type="submit" disabled={posting}>
          {posting ? "Signing…" : "Sign guestbook"}
        </button>
      </form>
      {loading ? (
        <div className="skeleton quiet-loading" aria-hidden="true">
          <span />
        </div>
      ) : null}
      {!loading && entries.length === 0 ? <QuietState>No notes yet. Be the first signature.</QuietState> : null}
      <ol className="entries">
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
            </div>
          </li>
        ))}
      </ol>
      <Toast toast={toast} />
    </section>
  );
}

function sortEntries(entries: GuestbookEntry[]): GuestbookEntry[] {
  return entries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
