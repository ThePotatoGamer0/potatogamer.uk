import type { SiteLink } from "../../../shared/site";
import { Icon } from "../Icons";
import { QuietState } from "../QuietState";

export function LinksCard({ links }: { links: SiteLink[] }) {
  return (
    <section className="card" id="links">
      <p className="kicker">Links</p>
      <h2>Find me</h2>
      {links.length === 0 ? (
        <QuietState>No links yet. Add some from the admin dashboard.</QuietState>
      ) : (
        <div className="link-list">
          {links.map((link) => (
            <a
              key={link.id}
              className="link-tile"
              href={link.url}
              target="_blank"
              rel="me noreferrer noopener"
            >
              <span className="link-icon">
                <Icon name={link.icon} />
              </span>
              <span>
                <strong>{link.title}</strong>
                {link.handle ? <small>{link.handle}</small> : null}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
