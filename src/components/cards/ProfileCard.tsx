import { useLayoutEffect, useRef, useState } from "react";
import { isDiscordId, type KvRow } from "../../../shared/site";
import { useConfig, useDiscordProfiles, usePresence } from "../../context/AppProviders";
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
  const { config } = useConfig();
  const ownerId = isDiscordId(config.identity.discordId) ? config.identity.discordId : "";
  const { owner, ready } = usePresence();
  const { users: profiles, statuses } = useDiscordProfiles();
  const bot = ownerId ? statuses[ownerId] : undefined;
  const user = ownerId ? (owner?.discord_user ?? profiles[ownerId] ?? undefined) : undefined;
  const name = displayName(user, config.identity.name || "Home");
  const initial = name.trim().charAt(0).toUpperCase() || "H";
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
            <span className="avatar monogram">{!ownerId || ready ? initial : ""}</span>
          </div>
        )}
        <div className="profile-id">
          <h1 key={name} className="fade-swap">{name}</h1>
          {user?.username ? <p className="handle">@{user.username}</p> : null}
          {ownerId ? (
            <p className={`status-pill ${status}`}>
              <span className={`status-dot inline ${status}`} aria-hidden="true" />
              {owner || bot || ready ? STATUS_LABEL[status] : "Checking"}
            </p>
          ) : null}
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
