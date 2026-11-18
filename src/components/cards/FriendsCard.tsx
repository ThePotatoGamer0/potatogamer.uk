import type { FriendConfig } from "../../../shared/site";
import { safeHttpUrl } from "../../../shared/site";
import { useDiscordProfiles, usePresence } from "../../context/AppProviders";
import { Avatar } from "../Avatar";
import { QuietState } from "../QuietState";
import { displayName, kvString } from "../../lib/discord";
import { withSpeechMarks } from "../../lib/format";
import { STATUS_LABEL, type DiscordStatus } from "../../lib/lanyard";

export function FriendsCard({ friends }: { friends: FriendConfig[] }) {
  const { users, ready } = usePresence();
  const { users: profiles } = useDiscordProfiles();

  return (
    <section className="card">
      <p className="kicker">Friends</p>
      <h2>People</h2>
      {friends.length === 0 ? (
        <QuietState>No friends added yet. Discord IDs can be saved from the admin dashboard.</QuietState>
      ) : (
        <ul className="friend-list">
          {friends.map((friend) => {
            const presence = users[friend.discordId];
            const user = presence?.discord_user ?? profiles[friend.discordId] ?? undefined;
            const quote = withSpeechMarks(kvString(presence?.kv, "quote"));
            const href = safeHttpUrl(kvString(presence?.kv, "url"));
            const status: DiscordStatus = presence?.discord_status ?? "offline";
            const missing = ready && presence === null;
            return (
              <li key={friend.id} className="friend">
                {user ? (
                  <Avatar user={user} status={status} size="sm" />
                ) : (
                  <div className="avatar-stack sm" aria-hidden="true">
                    <span className="avatar monogram">?</span>
                  </div>
                )}
                <div className="friend-copy">
                  <div className="friend-name">
                    <strong>{user ? displayName(user, friend.label || "Friend") : friend.label || "Discord user"}</strong>
                    <span className={`status-dot inline ${presence ? status : "offline"}`} title={presence ? STATUS_LABEL[status] : "Unknown"} />
                    {friend.label && user ? <em>{friend.label}</em> : null}
                  </div>
                  {user ? <p className="mono friend-id">@{user.username}</p> : null}
                  {quote ? <p className="friend-quote">{quote}</p> : null}
                  {missing ? <p className="status-pill offline">Not on Lanyard</p> : null}
                </div>
                {href ? (
                  <a className="btn tonal compact" href={href} target="_blank" rel="noreferrer noopener">
                    Visit
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
