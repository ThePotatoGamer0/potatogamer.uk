import { useEffect, useRef, useState } from "react";
import type { DiscordStatus } from "../lib/lanyard";

export function StatusDot({
  status,
  label,
  inline = false,
}: {
  status: DiscordStatus;
  label: string;
  inline?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean } | null>(null);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip]);

  function show() {
    const node = anchor.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const below = rect.top < 56;
    const x = Math.min(window.innerWidth - 120, Math.max(120, rect.left + rect.width / 2));
    setTip({ x, y: below ? rect.bottom : rect.top, below });
  }

  return (
    <>
      <span
        ref={anchor}
        className={`status-dot ${status}${inline ? " inline" : ""} tip-anchor`}
        tabIndex={0}
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onFocus={show}
        onBlur={() => setTip(null)}
      />
      {tip ? (
        <span className={tip.below ? "md-tooltip below" : "md-tooltip"} role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {label}
        </span>
      ) : null}
    </>
  );
}
