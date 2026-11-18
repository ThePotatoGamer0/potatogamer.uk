import { useEffect, useState } from "react";
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
  const ticking = Boolean(owner && (owner.listening_to_spotify || owner.activities.some((activity) => activity.timestamps?.start)));
  const now = useTicker(ticking);

  return (
    <section className="card activity-card" aria-live="polite">
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
  const extra = spotify ? primary : others[1];
  const platform = platformLabel(presence);

  return (
    <div className="activity-body">
      <p className={`status-pill ${presence.discord_status}`}>
        <span className={`status-dot inline ${presence.discord_status}`} aria-hidden="true" />
        {STATUS_LABEL[presence.discord_status]}
        {platform ? <span className="status-platform">{platform}</span> : null}
      </p>
      {custom ? <CustomStatus activity={custom} /> : null}
      {spotify ? <SpotifyBlock spotify={spotify} now={now} /> : null}
      {!spotify && primary ? <PresenceBlock activity={primary} now={now} /> : null}
      {!spotify && !primary ? <QuietState>No game, IDE, or track running.</QuietState> : null}
      {extra && (spotify || primary) ? (
        <p className="also">
          Also {activityKind(extra.type).toLowerCase()} <strong>{extra.name}</strong>
          {extra.details ? ` — ${extra.details}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function CustomStatus({ activity }: { activity: LanyardActivity }) {
  const emoji = emojiUrl(activity.emoji);
  return (
    <p className="custom-status">
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
    <article className="now-playing">
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
    <article className="now-playing">
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
