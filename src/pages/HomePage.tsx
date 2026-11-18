import { useEffect, useState } from "react";
import { ActivityCard } from "../components/cards/ActivityCard";
import { FriendsCard } from "../components/cards/FriendsCard";
import { GuestbookCard } from "../components/cards/GuestbookCard";
import { KvCard } from "../components/cards/KvCard";
import { SetupCard } from "../components/cards/SetupCard";
import { LinksCard } from "../components/cards/LinksCard";
import { ProfileCard } from "../components/cards/ProfileCard";
import { CardBoundary } from "../components/Toast";
import { useConfig } from "../context/AppProviders";

export function HomePage() {
  const { config, error } = useConfig();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`row-${highlightId}`)?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
    const timer = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  return (
    <div className="bento">
      {error ? <p className="banner span-12">Showing the built-in site defaults. {error}</p> : null}
      <div className="span-5">
        <CardBoundary title="Profile">
          <ProfileCard quoteFallback={config.quote} interests={config.interests} onInterest={setHighlightId} />
        </CardBoundary>
      </div>
      <div className="span-7">
        <CardBoundary title="Live activity">
          <ActivityCard />
        </CardBoundary>
      </div>
      <div className="span-4">
        <CardBoundary title="Links">
          <LinksCard links={config.links} />
        </CardBoundary>
      </div>
      <div className="span-8 friends-slot">
        <CardBoundary title="Friends">
          <FriendsCard friends={config.friends} />
        </CardBoundary>
      </div>
      <div className="span-12">
        <CardBoundary title="Interests">
          <KvCard
            id="interests"
            kicker="Interests"
            title="What I’m into"
            rows={config.interests}
            empty="No interests yet."
            highlightId={highlightId}
          />
        </CardBoundary>
      </div>
      <div className="span-6">
        <CardBoundary title="PC setup">
          <SetupCard id="setup" kicker="PC setup" title="My Machine" rows={config.setup} />
        </CardBoundary>
      </div>
      <div className="span-6">
        <CardBoundary title="Homelab">
          <SetupCard id="homelab" kicker="Homelab" title="Raspberry Pi 5" rows={config.homelab} />
        </CardBoundary>
      </div>
      <div className="span-12">
        <CardBoundary title="Guestbook">
          <GuestbookCard />
        </CardBoundary>
      </div>
    </div>
  );
}
