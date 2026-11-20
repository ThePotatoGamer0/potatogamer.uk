import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isDiscordId, passwordIssue, type SiteConfig } from "../../shared/site";
import { Toast, useToast } from "../components/Toast";
import { useConfig } from "../context/AppProviders";
import { ApiError, api } from "../lib/api";
import { writeAdminPassword } from "../lib/session";

function hostLabel(): string {
  return window.location.hostname.replace(/^www\./i, "");
}

export function SetupPage() {
  const navigate = useNavigate();
  const { setConfig, setNeedsSetup, reload } = useConfig();
  const { toast, show } = useToast();
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [siteName, setSiteName] = useState(hostLabel);
  const [quote, setQuote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Set up";
  }, []);

  function nextPassword(event: FormEvent) {
    event.preventDefault();
    const issue = passwordIssue(password, confirm);
    if (issue) {
      show("err", issue);
      return;
    }
    setStep(1);
  }

  function nextDiscord(event: FormEvent) {
    event.preventDefault();
    const id = discordId.trim();
    if (id && !isDiscordId(id)) {
      show("err", "Discord ID must be a 17–20 digit number.");
      return;
    }
    setDiscordId(id);
    setStep(2);
  }

  async function finish(event: FormEvent) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) {
      show("err", "A display name is required.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const data = await api<{ config: SiteConfig }>("/api/setup", {
        method: "POST",
        body: JSON.stringify({
          password,
          confirm,
          discordId,
          name: displayName,
          siteName: siteName.trim(),
          quote,
        }),
      });
      writeAdminPassword(password);
      setConfig(data.config);
      setNeedsSetup(false);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        show("err", "This site is already set up.");
        try {
          await reload();
          navigate("/", { replace: true });
        } catch {
          // Stay here if the site still needs setup.
        }
        return;
      }
      show("err", error instanceof Error ? error.message : "Could not finish setup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <p className="kicker">Setup</p>
        <h1>Set up this site</h1>
        <p className="lede">Step {step + 1} of 3. This domain doesn’t have a site yet.</p>
      </header>

      {step === 0 ? (
        <section className="card">
          <h2>Password</h2>
          <p className="muted">This unlocks settings later. It is stored as a hash.</p>
          <form className="stack" onSubmit={nextPassword}>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit">
              Continue
            </button>
          </form>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card">
          <h2>Discord</h2>
          <p className="muted">Used for your avatar, status, and activity. You can skip this.</p>
          <form className="stack" onSubmit={nextDiscord}>
            <label className="field">
              <span>Discord user ID</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={discordId}
                onChange={(event) => setDiscordId(event.target.value)}
              />
            </label>
            <div className="savebar">
              <button className="btn tonal" type="button" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn tonal" type="button" onClick={() => { setDiscordId(""); setStep(2); }}>
                Skip
              </button>
              <button className="btn" type="submit">
                Continue
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card">
          <h2>About you</h2>
          <form className="stack" onSubmit={(event) => void finish(event)}>
            <label className="field">
              <span>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} />
            </label>
            <label className="field">
              <span>Site name</span>
              <input value={siteName} onChange={(event) => setSiteName(event.target.value)} maxLength={80} />
            </label>
            <label className="field">
              <span>Quote</span>
              <textarea rows={3} maxLength={280} value={quote} onChange={(event) => setQuote(event.target.value)} />
            </label>
            <div className="savebar">
              <button className="btn tonal" type="button" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Finish"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <Toast toast={toast} />
    </div>
  );
}
