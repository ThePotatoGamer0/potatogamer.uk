import { useEffect, useRef, useState } from "react";
import { QuietState } from "../QuietState";
import { usePresence } from "../../context/AppProviders";
import { discordAssetUrl, emojiUrl } from "../../lib/discord";
import { formatClock, formatElapsed } from "../../lib/format";
import {
  activityKind,
  platformLabel,
  STATUS_LABEL,
  type LanyardActivity,
  type LanyardPresence,
  type LanyardSpotify,
} from "../../lib/lanyard";

export function ActivityCard() {
  const { owner, ready } = usePresence();
  const now = useTicker(Boolean(owner && (owner.listening_to_spotify || owner.activities.some((activity) => activity.timestamps?.start))));

  return (
    <section className="card activity-card" id="activity" aria-live="polite">
      <p className="kicker">Live activity</p>
      <h2>Right now</h2>
      {!ready && !owner ? (
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : owner ? (
        <ActivityBody presence={owner} now={now} />
      ) : (
        <QuietState>Lanyard isn’t responding right now.</QuietState>
      )}
    </section>
  );
}

function ActivityBody({ presence, now }: { presence: LanyardPresence; now: number }) {
  const custom = presence.activities.find((activity) => activity.type === 4);
  const others = presence.activities.filter((activity) => activity.type !== 4 && activity.name !== "Spotify");
  const spotify = presence.listening_to_spotify ? presence.spotify : null;
  const primary = others[0];
  const shown = useSettledActivity(spotify, primary);
  const extra = shown.spotify ? primary : others[1];
  const platform = platformLabel(presence);

  return (
    <div className="activity-body">
      <p className={`status-pill ${presence.discord_status}`}>
        <span className={`status-dot inline ${presence.discord_status}`} aria-hidden="true" />
        {STATUS_LABEL[presence.discord_status]}
        {platform ? <span className="status-platform">{platform}</span> : null}
      </p>
      {custom ? <CustomStatus key={custom.state || custom.name} activity={custom} /> : null}
      {shown.spotify ? <SpotifyBlock key={shown.spotify.track_id} spotify={shown.spotify} now={now} /> : null}
      {!shown.spotify && shown.primary ? (
        <PresenceBlock key={activitySignature(null, shown.primary)} activity={shown.primary} now={now} />
      ) : null}
      {shown.key === "none" ? (
        <div className="fade-swap">
          <QuietState>No game, IDE, or track running.</QuietState>
        </div>
      ) : null}
      {shown.key !== "none" && extra && (shown.spotify || shown.primary) ? (
        <p className="also">
          Also {activityKind(extra.type).toLowerCase()} <strong>{extra.name}</strong>
          {extra.details ? ` — ${extra.details}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Discord drops RPC for a moment between tracks. Hold the last one until the next state is clear. */
const TRACK_GAP_MS = 1600;

function activitySignature(spotify: LanyardSpotify | null, primary: LanyardActivity | undefined): string {
  if (spotify) return `spotify:${spotify.track_id}`;
  if (primary) return `presence:${primary.application_id ?? ""}:${primary.name}:${primary.details ?? ""}:${primary.state ?? ""}`;
  return "none";
}

function useSettledActivity(spotify: LanyardSpotify | null, primary: LanyardActivity | undefined) {
  const key = activitySignature(spotify, primary);
  const latest = useRef({ spotify, primary });
  latest.current = { spotify, primary };
  const [shown, setShown] = useState({ key, spotify, primary });

  useEffect(() => {
    if (key !== "none") {
      setShown({ key, spotify: latest.current.spotify, primary: latest.current.primary });
      return;
    }
    const timer = window.setTimeout(() => {
      setShown({ key: "none", spotify: null, primary: undefined });
    }, TRACK_GAP_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  return shown;
}

function CustomStatus({ activity }: { activity: LanyardActivity }) {
  const emoji = emojiUrl(activity.emoji);
  return (
    <p className="custom-status fade-swap">
      {emoji ? <img src={emoji} alt={activity.emoji?.name ?? ""} width={22} height={22} /> : null}
      {!emoji && activity.emoji?.name ? <span aria-hidden="true">{activity.emoji.name}</span> : null}
      <span>{activity.state || "Custom status"}</span>
    </p>
  );
}

function SpotifyBlock({ spotify, now }: { spotify: LanyardSpotify; now: number }) {
  const start = spotify.timestamps.start;
  const end = spotify.timestamps.end;
  const ratio = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;
  return (
    <article className="now-playing fade-swap">
      <img className="cover" src={spotify.album_art_url} alt="" width={72} height={72} />
      <div className="now-copy">
        <p className="kind">Listening to Spotify</p>
        <p className="track">{spotify.song}</p>
        <p className="muted">
          {spotify.artist}
          {spotify.album ? ` · ${spotify.album}` : ""}
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="mono time">
          <span>{formatClock(now - start)}</span>
          <span>{formatClock(end - start)}</span>
        </p>
      </div>
    </article>
  );
}

function PresenceBlock({ activity, now }: { activity: LanyardActivity; now: number }) {
  const art = discordAssetUrl(activity.application_id, activity.assets?.large_image);
  const badge = discordAssetUrl(activity.application_id, activity.assets?.small_image);
  const start = activity.timestamps?.start;
  const end = activity.timestamps?.end;
  const paused = activity.assets?.small_text?.toLowerCase() === "paused";
  const ratio = start && end && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : null;

  return (
    <article className="now-playing fade-swap">
      <div className="cover-wrap">
        {art ? (
          <img className="cover" src={art} alt={activity.assets?.large_text || ""} width={72} height={72} />
        ) : (
          <div className="cover placeholder" aria-hidden="true">
            {activity.name.slice(0, 1)}
          </div>
        )}
        {badge ? <img className="badge" src={badge} alt={activity.assets?.small_text || ""} /> : null}
      </div>
      <div className="now-copy">
        <p className="kind">
          {activityKind(activity.type)} {activity.name}
        </p>
        {activity.details ? <p className="track">{activity.details}</p> : <p className="track">{activity.name}</p>}
        {activity.state ? <p className="muted">{activity.state}</p> : null}
        {ratio !== null ? (
          <>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <p className="mono time">
              <span>{formatClock(now - (start ?? now))}</span>
              <span>{formatClock((end ?? now) - (start ?? now))}</span>
            </p>
          </>
        ) : start && !paused ? (
          <p className="mono elapsed">{formatElapsed(now - start)}</p>
        ) : paused ? (
          <p className="mono elapsed">{activity.assets?.small_text || "Paused"}</p>
        ) : null}
      </div>
    </article>
  );
}

function useTicker(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}
