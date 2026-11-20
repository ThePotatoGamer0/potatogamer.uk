import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Hct, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import React from "react";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
const fontPath = fileURLToPath(new URL("./Geist-Regular.ttf", import.meta.url));

let wasmReady;
let fontReady;

export async function renderOgImage(doc) {
  try {
    return await rasterize(doc, true);
  } catch (error) {
    console.error("[api/og] picture skipped", error instanceof Error ? error.message : "error");
    return rasterize(doc, false);
  }
}

async function rasterize(doc, picture) {
  await ensureWasm();
  const font = await loadFont();
  const svg = await satori(cardImage(doc, picture), {
    width: 1200,
    height: 630,
    fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }],
  });
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render();
  const png = Buffer.from(rendered.asPng());
  rendered.free();
  return png;
}

function ensureWasm() {
  wasmReady ??= initWasm(readFile(wasmPath)).catch((error) => {
    wasmReady = undefined;
    throw error;
  });
  return wasmReady;
}

function loadFont() {
  fontReady ??= readFile(fontPath);
  return fontReady;
}

function cardImage(doc, picture) {
  const colors = palette(doc.accent || "#f5d8da");
  const items = (Array.isArray(doc.items) ? doc.items : []).map((item) => ({
    label: plain(item?.label),
    detail: plain(item?.detail),
    image: picture ? item?.image || null : null,
  }));
  const showAvatar = Boolean(picture && doc.pictureKind === "avatar" && doc.picture);
  const showPoster = Boolean(picture && doc.layout === "media" && doc.picture);

  return h(
    "div",
    {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: colors.background,
          padding: 36,
          fontFamily: "Geist",
          color: colors.ink,
        },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          background: colors.card,
          borderRadius: 32,
          padding: "36px 40px",
          border: `1px solid ${colors.line}`,
        },
      },
      header(doc, colors, showAvatar),
      doc.lede ? text(plain(doc.lede), { fontSize: 32, lineHeight: 1.25, marginTop: 22, color: colors.ink }) : null,
      body(doc.layout, items, colors, showPoster ? doc.picture : null),
    ),
  );
}

function header(doc, colors, showAvatar) {
  const handle = doc.layout === "profile" ? plain(doc.lines?.[0]) : "";
  const title = h(
    "div",
    { style: { display: "flex", flexDirection: "column" } },
    text(plain(doc.kicker).toUpperCase(), {
      fontSize: 18,
      letterSpacing: 2,
      color: colors.muted,
    }),
    text(plain(doc.heading), { fontSize: 56, lineHeight: 1.05, marginTop: 8 }),
    handle.startsWith("@") ? text(handle, { fontSize: 24, marginTop: 6, color: colors.muted }) : null,
  );
  if (!showAvatar) return title;
  return h(
    "div",
    { style: { display: "flex", alignItems: "center" } },
    h("img", {
      src: doc.picture,
      width: 112,
      height: 112,
      style: { borderRadius: 56, marginRight: 24, objectFit: "cover" },
    }),
    title,
  );
}

function body(layout, items, colors, poster) {
  if (layout === "profile") return chips(items, colors);
  if (layout === "tiles") return tiles(items, colors);
  if (layout === "media") return shelf(items, colors, poster);
  return rows(items, colors);
}

function chips(items, colors) {
  const shown = items.filter((item) => item.label).slice(0, 6);
  if (shown.length === 0) return null;
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", marginTop: 28 } },
    ...shown.map((item) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            background: colors.tile,
            borderRadius: 999,
            padding: "12px 18px",
            marginRight: 12,
            marginBottom: 12,
            fontSize: 24,
          },
        },
        item.image
          ? h("img", {
              src: item.image,
              width: 28,
              height: 28,
              style: { borderRadius: 8, marginRight: 10, objectFit: "cover" },
            })
          : null,
        item.label,
      ),
    ),
  );
}

function rows(items, colors) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", marginTop: 28 } },
    ...items.slice(0, 5).map((item) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            background: colors.tile,
            borderRadius: 20,
            padding: "14px 18px",
            marginBottom: 12,
          },
        },
        text(item.label, { fontSize: 28, lineHeight: 1.2 }),
        item.detail ? text(item.detail, { fontSize: 22, lineHeight: 1.3, marginTop: 4, color: colors.muted }) : null,
      ),
    ),
  );
}

function tiles(items, colors) {
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", marginTop: 28 } },
    ...items.slice(0, 6).map((item) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            width: 500,
            background: colors.tile,
            borderRadius: 20,
            padding: 14,
            marginRight: 16,
            marginBottom: 16,
          },
        },
        item.image
          ? h("img", {
              src: item.image,
              width: 72,
              height: 72,
              style: { borderRadius: 16, marginRight: 14, objectFit: "cover" },
            })
          : null,
        h(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          text(item.label, { fontSize: 26, lineHeight: 1.2 }),
          item.detail ? text(item.detail, { fontSize: 20, marginTop: 4, color: colors.muted }) : null,
        ),
      ),
    ),
  );
}

function shelf(items, colors, poster) {
  return h(
    "div",
    { style: { display: "flex", marginTop: 28, flex: 1 } },
    poster
      ? h("img", {
          src: poster,
          width: 230,
          height: 330,
          style: { borderRadius: 18, objectFit: "cover", marginRight: 24 },
        })
      : null,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1 } },
      ...items.slice(0, 4).map((item) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              background: colors.tile,
              borderRadius: 18,
              padding: "12px 16px",
              marginBottom: 12,
            },
          },
          item.image && item.image !== poster
            ? h("img", {
                src: item.image,
                width: 42,
                height: 62,
                style: { borderRadius: 8, objectFit: "cover", marginRight: 14 },
              })
            : null,
          h(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            text(item.label, { fontSize: 26, lineHeight: 1.2 }),
            item.detail ? text(item.detail, { fontSize: 20, marginTop: 4, color: colors.muted }) : null,
          ),
        ),
      ),
    ),
  );
}

function text(value, style) {
  return h("div", { style: { display: "flex", ...style } }, value);
}

function h(type, props, ...children) {
  return React.createElement(type, props, ...children.filter((child) => child !== null && child !== undefined && child !== ""));
}

function palette(seed) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(seed) ? seed : "#f5d8da";
  const source = Hct.fromInt(argbFromHex(safe));
  const pastel = source.tone >= 78 && source.chroma <= 36;
  const shift = pastel ? Math.min(0, Math.max(-8, source.tone - 96)) : 0;
  const chroma = pastel ? Math.min(18, Math.max(12, source.chroma)) : 10;
  const paint = (tone, amount = chroma) => hexFromArgb(Hct.from(source.hue, amount, Math.max(78, tone + shift)).toInt());
  return {
    background: paint(93),
    card: paint(89),
    tile: paint(84, Math.min(20, chroma + 4)),
    ink: hexFromArgb(Hct.from(source.hue, 10, 20).toInt()),
    muted: hexFromArgb(Hct.from(source.hue, 8, 42).toInt()),
    line: hexFromArgb(Hct.from(source.hue, 8, 80).toInt()),
  };
}

function plain(value) {
  return String(value ?? "")
    .replace(/[^\u0020-\u024F\u2013\u2014\u2018\u2019\u201C\u201D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
