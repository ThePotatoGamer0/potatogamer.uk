import { useLayoutEffect, useRef, useState } from "react";
import { OWNER_DISCORD_ID, type KvRow } from "../../../shared/site";
import { useDiscordProfiles, usePresence } from "../../context/AppProviders";
import { displayName, kvString } from "../../lib/discord";
import { withSpeechMarks } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/lanyard";
import { Avatar } from "../Avatar";
import { InterestImage } from "../InterestImage";

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
  const { users: profiles, statuses } = useDiscordProfiles();
  const bot = statuses[OWNER_DISCORD_ID];
  const user = owner?.discord_user ?? profiles[OWNER_DISCORD_ID] ?? undefined;
  const name = displayName(user);
  const quote = withSpeechMarks(kvString(owner?.kv, "quote") || quoteFallback);
  const status = owner?.discord_status ?? bot?.status ?? "offline";
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const [roomy, setRoomy] = useState(false);

  useLayoutEffect(() => {
    const node = quoteRef.current;
    if (!node) return;
    const update = () => {
      const next = node.clientHeight > 120;
      setRoomy((current) => (current === next ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="card profile-card" id="profile">
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
          <h1 key={name} className="fade-swap">{name}</h1>
          <p className="handle">{user ? `@${user.username}` : "@thepotatogamer"}</p>
          <p className={`status-pill ${status}`}>
            <span className={`status-dot inline ${status}`} aria-hidden="true" />
            {owner || bot || ready ? STATUS_LABEL[status] : "Checking"}
          </p>
        </div>
      </div>
      <blockquote ref={quoteRef} className={roomy ? "quote roomy" : "quote"}>
        <span key={quote} className="fade-swap">{quote}</span>
      </blockquote>
      {interests.length > 0 ? (
        <div className="chips" aria-label="Interests">
          {interests.map((interest) =>
            interest.label ? (
              <button key={interest.id} type="button" className={interest.image ? "chip has-shot" : "chip"} onClick={() => onInterest(interest.id)}>
                {interest.image ? <InterestImage src={interest.image} className="chip-shot" /> : null}
                {interest.label}
              </button>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}
