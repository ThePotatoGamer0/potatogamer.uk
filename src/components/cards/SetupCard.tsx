import { CircuitBoard, Cpu, Gpu, HardDrive, MemoryStick, type LucideIcon } from "lucide-react";
import type { SpecIcon, SpecRow } from "../../../shared/site";
import { QuietState } from "../QuietState";

const SPEC_LUCIDE: Record<SpecIcon, LucideIcon> = {
  cpu: Cpu,
  gpu: Gpu,
  "memory-stick": MemoryStick,
  "hard-drive": HardDrive,
  "circuit-board": CircuitBoard,
};

export function SetupCard({ rows }: { rows: SpecRow[] }) {
  return (
    <section className="card" id="setup">
      <p className="kicker">PC setup</p>
      <h2>The machines</h2>
      {rows.length === 0 ? (
        <QuietState>No specs yet.</QuietState>
      ) : (
        <ul className="spec-grid">
          {rows.map((row) => (
            <li key={row.id} className="spec">
              <span className="spec-icon">
                <SpecGlyph name={row.icon} />
              </span>
              <span className="spec-copy">
                <small>{row.label}</small>
                <strong>{row.value}</strong>
                {row.detail ? <em>{row.detail}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpecGlyph({ name }: { name: SpecIcon }) {
  const Glyph = SPEC_LUCIDE[name] ?? Cpu;
  return <Glyph size={20} strokeWidth={1.8} aria-hidden="true" />;
}
