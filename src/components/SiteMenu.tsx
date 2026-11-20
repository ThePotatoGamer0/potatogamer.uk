import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useNavigate } from "react-router-dom";
import { isOgCard, type OgCard } from "../../shared/og";
import { Toast } from "./Toast";

const MODIFIER = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";

interface MenuTarget {
  text: string;
  field: HTMLInputElement | HTMLTextAreaElement | null;
  start: number;
  end: number;
  writable: boolean;
  link: string | null;
  image: string | null;
  card: OgCard | null;
  scope: HTMLElement | null;
}

const EMPTY: MenuTarget = {
  text: "",
  field: null,
  start: 0,
  end: 0,
  writable: false,
  link: null,
  image: null,
  card: null,
  scope: null,
};

export function SiteMenu({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState<MenuTarget>(EMPTY);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const noticeTimer = useRef<number | null>(null);

  function flash(text: string) {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice({ kind: "err", text });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
  }

  async function copyText(value: string, failure: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      flash(failure);
    }
  }

  async function cut() {
    const field = target.field;
    if (!field) return;
    try {
      await navigator.clipboard.writeText(target.text);
    } catch {
      flash("Couldn’t cut that");
      return;
    }
    writeField(field, target.start, target.end, "");
    afterClose.current = () => field.focus();
  }

  async function paste() {
    const field = target.field;
    if (!field) return;
    let value = "";
    try {
      value = await navigator.clipboard.readText();
    } catch {
      flash("Couldn’t paste from the clipboard");
      return;
    }
    writeField(field, target.start, target.end, value);
    afterClose.current = () => field.focus();
  }

  function selectAll() {
    const field = target.field;
    const scope = target.scope;
    afterClose.current = () => {
      if (field && !field.disabled) {
        field.focus();
        field.select();
        return;
      }
      if (!scope) return;
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(scope);
      selection.removeAllRanges();
      selection.addRange(range);
    };
  }

  function openLink(url: string, newTab: boolean) {
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const next = new URL(url);
    if (next.origin === window.location.origin) {
      navigate(`${next.pathname}${next.search}${next.hash}`);
      return;
    }
    window.location.assign(url);
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="scroller" onContextMenu={(event) => setTarget(readTarget(event))}>
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="site-menu"
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            const restore = afterClose.current;
            afterClose.current = null;
            if (!restore) return;
            event.preventDefault();
            restore();
          }}
        >
          <MenuItem label="Cut" shortcut={`${MODIFIER}X`} disabled={!target.writable || !target.text} onSelect={() => void cut()} />
          <MenuItem label="Copy" shortcut={`${MODIFIER}C`} disabled={!target.text} onSelect={() => void copyText(target.text, "Couldn’t copy that")} />
          <MenuItem label="Paste" shortcut={`${MODIFIER}V`} disabled={!target.writable} onSelect={() => void paste()} />
          <MenuItem label="Select all" shortcut={`${MODIFIER}A`} onSelect={selectAll} />
          {target.link ? (
            <>
              <ContextMenu.Separator />
              <MenuItem label="Open link" onSelect={() => openLink(target.link!, false)} />
              <MenuItem label="Open link in new tab" onSelect={() => openLink(target.link!, true)} />
              <MenuItem label="Copy link address" onSelect={() => void copyText(target.link!, "Couldn’t copy that link")} />
            </>
          ) : null}
          {target.image ? (
            <>
              <ContextMenu.Separator />
              <MenuItem label="Open image in new tab" onSelect={() => openLink(target.image!, true)} />
              <MenuItem label="Copy image address" onSelect={() => void copyText(target.image!, "Couldn’t copy that image address")} />
            </>
          ) : null}
          {target.card ? (
            <>
              <ContextMenu.Separator />
              <MenuItem
                label="Copy card link"
                onSelect={() => void copyText(new URL(`/${target.card}`, window.location.origin).href, "Couldn’t copy the card link")}
              />
            </>
          ) : null}
        </ContextMenu.Content>
      </ContextMenu.Portal>
      <Toast toast={notice} />
    </ContextMenu.Root>
  );
}

function MenuItem({
  label,
  shortcut,
  disabled,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <ContextMenu.Item className="site-menu-item" disabled={disabled} onSelect={onSelect}>
      <span>{label}</span>
      {shortcut ? <span className="site-menu-key">{shortcut}</span> : null}
    </ContextMenu.Item>
  );
}

function readTarget(event: MouseEvent): MenuTarget {
  const node = event.target instanceof Element ? event.target : null;
  const field = textField(node);
  const secret = field instanceof HTMLInputElement && field.type === "password";
  const start = field?.selectionStart ?? 0;
  const end = field?.selectionEnd ?? 0;
  const selected = field ? field.value.slice(Math.min(start, end), Math.max(start, end)) : window.getSelection()?.toString() ?? "";
  const anchor = node?.closest("a[href]");
  const link = anchor instanceof HTMLAnchorElement ? httpUrl(anchor.href) : null;
  const picture = node?.closest("img");
  const image = picture instanceof HTMLImageElement ? imageUrl(picture.currentSrc || picture.src) : null;
  const section = node?.closest("section.card");
  const cardId = section?.id ?? "";
  return {
    text: secret ? "" : selected,
    field,
    start,
    end,
    writable: Boolean(field && !field.readOnly && !field.disabled),
    link,
    image,
    card: isOgCard(cardId) ? cardId : null,
    scope: section instanceof HTMLElement ? section : document.getElementById("content"),
  };
}

function textField(node: Element | null): HTMLInputElement | HTMLTextAreaElement | null {
  const field = node?.closest("input, textarea");
  if (field instanceof HTMLTextAreaElement) return field;
  if (!(field instanceof HTMLInputElement)) return null;
  const blocked = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"];
  return blocked.includes(field.type) ? null : field;
}

function imageUrl(value: string): string | null {
  return value.startsWith("data:image/") ? value : httpUrl(value);
}

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function writeField(field: HTMLInputElement | HTMLTextAreaElement, start: number, end: number, value: string) {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  field.focus();
  field.setSelectionRange(from, to);
  if (value && document.execCommand("insertText", false, value)) return;
  field.setRangeText(value, from, to, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
