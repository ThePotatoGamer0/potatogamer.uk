import type { KvRow } from "../../../shared/site";
import { InterestImage } from "../InterestImage";
import { QuietState } from "../QuietState";

export function KvCard({
  id,
  kicker,
  title,
  rows,
  empty,
  highlightId,
}: {
  id?: string;
  kicker: string;
  title: string;
  rows: KvRow[];
  empty: string;
  highlightId?: string | null;
}) {
  return (
    <section className="card" id={id}>
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <QuietState>{empty}</QuietState>
      ) : (
        <ul className="interest-grid">
          {rows.map((row) => (
            <li
              key={row.id}
              id={id === "interests" ? `row-${row.id}` : undefined}
              className={highlightId && highlightId === row.id ? "interest-tile is-hot" : "interest-tile"}
            >
              {row.image ? <InterestImage src={row.image} /> : null}
              <span className="interest-copy">
                <strong>{row.label}</strong>
                {row.value ? <small>{row.value}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
