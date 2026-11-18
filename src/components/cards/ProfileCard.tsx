import { OWNER_DISCORD_ID, type KvRow } from "../../../shared/site";
import { useDiscordProfiles, usePresence } from "../../context/AppProviders";
import { displayName, kvString } from "../../lib/discord";
import { withSpeechMarks } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/lanyard";
import { Avatar } from "../Avatar";

export function ProfileCard({
  quoteFallback,
  interests,
  onInterest,
}: {
  quoteFallback: string;
  interests: KvRow[];
  onInterest: (id: string) => void;
}) {
  const { owner, ready } = usePresence();
  const { users: profiles } = useDiscordProfiles();
  const user = owner?.discord_user ?? profiles[OWNER_DISCORD_ID] ?? undefined;
  const name = displayName(user);
  const quote = withSpeechMarks(kvString(owner?.kv, "quote") || quoteFallback);
  const status = owner?.discord_status ?? "offline";

  return (
    <section className="card profile-card">
      <p className="kicker">Profile</p>
      <div className="profile-head">
        {user ? (
          <Avatar user={user} status={status} />
        ) : (
          <div className="avatar-stack lg" aria-hidden="true">
            <span className="avatar monogram">{ready ? "P" : ""}</span>
          </div>
        )}
        <div className="profile-id">
          <h1>{name}</h1>
          <p className="handle">{user ? `@${user.username}` : "@thepotatogamer"}</p>
          <p className={`status-pill ${status}`}>
            <span className={`status-dot inline ${status}`} aria-hidden="true" />
            {ready ? STATUS_LABEL[status] : "Checking Lanyard"}
          </p>
        </div>
      </div>
      <blockquote className="quote">{quote}</blockquote>
      {interests.length > 0 ? (
        <div className="chips" aria-label="Interests">
          {interests.map((interest) =>
            interest.label ? (
              <button key={interest.id} type="button" className="chip" onClick={() => onInterest(interest.id)}>
                {interest.label}
              </button>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}
