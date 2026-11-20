import { useEffect, useRef, useState } from "react";
import { externalDestination } from "../lib/externalLink";

interface PendingLink {
  url: string;
  newTab: boolean;
}

export function ExternalLinkGuard() {
  const [pending, setPending] = useState<PendingLink | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 && event.button !== 1) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = externalDestination(anchor.href, window.location.hostname);
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({
        url: destination,
        newTab: anchor.target === "_blank" || event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey,
      });
    };
    document.addEventListener("click", open, true);
    document.addEventListener("auxclick", open, true);
    return () => {
      document.removeEventListener("click", open, true);
      document.removeEventListener("auxclick", open, true);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  function go() {
    if (!pending) return;
    const { url, newTab } = pending;
    setPending(null);
    if (newTab) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.assign(url);
  }

  return (
    <dialog ref={dialogRef} className="leave-dialog" onClose={() => setPending(null)}>
      <h2>Leave this site?</h2>
      <p>Are you sure you want to go to:</p>
      <p className="leave-url">{pending?.url}</p>
      <div className="leave-actions">
        <button type="button" className="btn tonal" onClick={() => setPending(null)} autoFocus>
          Stay
        </button>
        <button type="button" className="btn" onClick={go}>
          Continue
        </button>
      </div>
    </dialog>
  );
}
