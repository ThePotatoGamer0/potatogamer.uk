import type { KvRow } from "../../../shared/site";
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
        <dl className="kv">
          {rows.map((row) => (
            <div
              key={row.id}
              id={id === "interests" ? `row-${row.id}` : undefined}
              className={highlightId && highlightId === row.id ? "kv-row is-hot" : "kv-row"}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
