import { useEffect, useRef, useState } from "react";
import { isOgCard, type OgCard } from "../../shared/og";
import { Toast } from "./Toast";

interface MenuState {
  id: OgCard;
  x: number;
  y: number;
}

export function CardLinkMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const id = cardFromTarget(event.target);
      if (!id) {
        setMenu(null);
        return;
      }
      event.preventDefault();
      setMenu({ id, x: event.clientX, y: event.clientY });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (panel.current?.contains(event.target as Node)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    panel.current?.querySelector("button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  function place(node: HTMLDivElement | null) {
    panel.current = node;
    if (!node || !menu) return;
    const rect = node.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8));
    const y = Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  async function copyLink() {
    if (!menu) return;
    const url = new URL(`/${menu.id}`, window.location.origin).href;
    const id = menu.id;
    setMenu(null);
    try {
      await navigator.clipboard.writeText(url);
      flash("ok", "Link copied");
    } catch {
      flash("err", `Couldn’t copy the ${id} link`);
    }
  }

  function flash(kind: "ok" | "err", text: string) {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice({ kind, text });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
  }

  return (
    <>
      {menu ? (
        <div ref={place} className="card-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" role="menuitem" onClick={() => void copyLink()}>
            Copy link
          </button>
        </div>
      ) : null}
      <Toast toast={notice} />
    </>
  );
}

function cardFromTarget(target: EventTarget | null): OgCard | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("a, button, input, textarea, select, [contenteditable='true']")) return null;
  const id = target.closest("section.card")?.id ?? "";
  return isOgCard(id) ? id : null;
}
