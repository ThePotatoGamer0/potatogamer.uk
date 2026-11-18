import type { ReactNode } from "react";

export function QuietState({ children }: { children: ReactNode }) {
  return (
    <div className="quiet">
      <span className="quiet-mark" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
