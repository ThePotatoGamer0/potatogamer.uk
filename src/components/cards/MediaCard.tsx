import { useEffect, useState } from "react";
import { mediaArt, type MediaKind } from "../../../shared/site";
import { useConfig } from "../../context/AppProviders";
import { QuietState } from "../QuietState";

const KIND_LABEL: Record<MediaKind, string> = {
  movie: "Movie",
  tv: "Show",
  anime: "Anime",
  game: "Game",
};

export function MediaCard() {
  const { config, loading } = useConfig();
  const items = config.media;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [artFailed, setArtFailed] = useState<Record<string, boolean>>({});
  const safeIndex = items.length === 0 ? 0 : index % items.length;
  const current = items[safeIndex];

  useEffect(() => {
    if (paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % items.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  function step(direction: -1 | 1) {
    setIndex((currentIndex) => (currentIndex + direction + items.length) % items.length);
  }

  return (
    <section className="card media" id="media" aria-roledescription="carousel" aria-label="Featured shows, anime, movies, and games">
      <p className="kicker">Media</p>
      <h2>On rotation</h2>
      {loading ? (
        <QuietState>Loading.</QuietState>
      ) : !current ? (
        <QuietState>No shows, anime, movies, or games featured yet.</QuietState>
      ) : (
        <div
          className={items.length > 1 ? "media-stage has-controls" : "media-stage"}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            setPaused(false);
          }}
        >
          {items.map((item, itemIndex) => {
            const active = itemIndex === safeIndex;
            const poster = artFailed[item.id] ? null : mediaArt(item.poster, "w500");
            const backdrop = mediaArt(item.backdrop, "w780");
            return (
              <div key={item.id} className={active ? "media-layer active" : "media-layer"} aria-hidden={!active}>
                {backdrop ? <img className="media-wash" src={backdrop} alt="" /> : null}
                <div className="poster-frame">
                  {poster ? (
                    <img
                      className="poster"
                      src={poster}
                      alt=""
                      onError={() => setArtFailed((currentMap) => ({ ...currentMap, [item.id]: true }))}
                    />
                  ) : (
                    <span className="poster monogram" aria-hidden="true">
                      {item.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="media-copy">
                  <p className="kind">
                    {KIND_LABEL[item.kind]}
                    {item.year ? <span>{item.year}</span> : null}
                  </p>
                  <h3>{item.name}</h3>
                  {item.overview ? <p className="media-overview">{item.overview}</p> : null}
                </div>
              </div>
            );
          })}
          {items.length > 1 ? (
            <div className="media-controls">
              <button type="button" className="icon-btn" aria-label="Previous title" onClick={() => step(-1)}>
                ‹
              </button>
              <div className="media-dots" role="tablist" aria-label="Featured titles">
                {items.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    className={itemIndex === safeIndex ? "media-dot current" : "media-dot"}
                    aria-label={item.name}
                    aria-current={itemIndex === safeIndex ? "true" : undefined}
                    onClick={() => setIndex(itemIndex)}
                  />
                ))}
              </div>
              <button type="button" className="icon-btn" aria-label="Next title" onClick={() => step(1)}>
                ›
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
