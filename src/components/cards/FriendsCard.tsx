import type { FriendConfig } from "../../../shared/site";
import { safeHttpUrl } from "../../../shared/site";
import { useDiscordProfiles, usePresence } from "../../context/AppProviders";
import { Avatar } from "../Avatar";
import { QuietState } from "../QuietState";
import { StatusDot } from "../StatusDot";
import { displayName, kvString, nameplateUrls } from "../../lib/discord";
import { withSpeechMarks } from "../../lib/format";
import { STATUS_LABEL, type DiscordStatus } from "../../lib/lanyard";

const UNKNOWN_ACTIVITY = "Not on lanyard, activity unknown";

export function FriendsCard({ friends }: { friends: FriendConfig[] }) {
  const { users, ready } = usePresence();
  const { users: profiles, statuses } = useDiscordProfiles();

  return (
    <section className="card friends">
      <p className="kicker">Friends</p>
      <h2>People</h2>
      {friends.length === 0 ? (
        <QuietState>No friends added yet. Discord IDs can be saved from the admin dashboard.</QuietState>
      ) : (
        <ul className="friend-list">
          {friends.map((friend) => {
            const presence = users[friend.discordId];
            const bot = statuses[friend.discordId];
            const user = presence?.discord_user ?? profiles[friend.discordId] ?? undefined;
            const quote = withSpeechMarks(kvString(presence?.kv, "quote"));
            const href = safeHttpUrl(kvString(presence?.kv, "url"));
            const status: DiscordStatus = presence?.discord_status ?? bot?.status ?? "offline";
            const missing = ready && presence === null && !bot;
            const label = presence
              ? STATUS_LABEL[presence.discord_status]
              : bot
                ? bot.activity
                  ? `${STATUS_LABEL[bot.status]} · ${bot.activity}`
                  : STATUS_LABEL[bot.status]
                : missing
                  ? UNKNOWN_ACTIVITY
                  : STATUS_LABEL[status];
            const nameplate = nameplateUrls(user?.collectibles?.nameplate?.asset);
            return (
              <li key={friend.id} className={nameplate ? "friend has-nameplate" : "friend"}>
                {nameplate ? <Nameplate video={nameplate.video} still={nameplate.still} /> : null}
                {user ? (
                  <Avatar
                    user={user}
                    status={missing ? "offline" : status}
                    statusTitle={label}
                    size="sm"
                  />
                ) : (
                  <div className="avatar-stack sm" aria-hidden="true">
                    <span className="avatar monogram">?</span>
                  </div>
                )}
                <div className="friend-copy">
                  <div className="friend-name">
                    <strong>{user ? displayName(user, friend.label || "Friend") : friend.label || "Discord user"}</strong>
                    <StatusDot
                      inline
                      status={missing ? "offline" : status}
                      label={label}
                    />
                    {friend.label && user ? <em>{friend.label}</em> : null}
                  </div>
                  {user ? <p className="mono friend-id">@{user.username}</p> : null}
                  {quote ? <p className="friend-quote">{quote}</p> : null}
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

function Nameplate({ video, still }: { video: string; still: string }) {
  return (
    <>
      <img className="nameplate still" src={still} alt="" />
      <video className="nameplate motion" src={video} poster={still} autoPlay muted loop playsInline aria-hidden="true" />
    </>
  );
}
