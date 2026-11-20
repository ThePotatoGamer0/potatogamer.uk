import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { DynamicScheme, Hct, TonalPalette, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import { LUCIDE, SIMPLE } from "./ogMarks.mjs";
import React from "react";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
const webpPath = require.resolve("@jsquash/webp/codec/dec/webp_dec.wasm");
const fontPath = fileURLToPath(new URL("./Geist-Regular.ttf", import.meta.url));

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 28;
const CARD_PAD = 28;
const FRAME = WIDTH - MARGIN * 2;
const INNER = FRAME - CARD_PAD * 2 - 2;
const GAP = 14;
const TILE = Math.floor((INNER - GAP) / 2);

let wasmReady;
let fontReady;
let webpReady;

export async function renderOgImage(doc) {
  const painted = await withRasterImages(doc);
  try {
    return await rasterize(painted, true);
  } catch (error) {
    console.error("[api/og] picture skipped", error instanceof Error ? error.message : "error");
    return rasterize(painted, false);
  }
}

async function rasterize(doc, picture) {
  await ensureWasm();
  const font = await loadFont();
  const svg = await satori(cardImage(doc, picture), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }],
  });
  const rendered = new Resvg(svg).render();
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

function ensureWebp() {
  webpReady ??= readFile(webpPath)
    .then((wasm) => initWebp({ wasmBinary: wasm }))
    .catch((error) => {
      webpReady = undefined;
      throw error;
    });
  return webpReady;
}

async function withRasterImages(doc) {
  const ink = palette(doc.accent || "#f5d8da").onAccent;
  const [picture, items] = await Promise.all([
    rasterSource(doc.picture),
    Promise.all(
      (Array.isArray(doc.items) ? doc.items : []).map(async (item) => ({
        ...item,
        image: await rasterSource(item?.image),
        icon: await iconPng(item?.mark, ink),
      })),
    ),
  ]);
  return { ...doc, picture, items };
}

async function rasterSource(source) {
  if (typeof source !== "string" || !source) return null;
  try {
    if (source.startsWith("data:image/webp")) return await webpDataToPng(source);
    if (source.startsWith("data:image/")) return source;
    if (!source.startsWith("https://")) return null;
    const response = await fetch(source, { redirect: "follow", signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 1_500_000) return null;
    const type = response.headers.get("content-type") || "";
    if (type.includes("webp") || bytes.subarray(0, 4).toString() === "RIFF") {
      await ensureWebp();
      const image = await decodeWebp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      return `data:image/png;base64,${encodePng(image.width, image.height, image.data).toString("base64")}`;
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return `data:image/png;base64,${bytes.toString("base64")}`;
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return `data:image/jpeg;base64,${bytes.toString("base64")}`;
    return null;
  } catch (error) {
    console.error("[api/og] picture skipped", error instanceof Error ? error.message : "error");
    return null;
  }
}

async function webpDataToPng(source) {
  await ensureWebp();
  const encoded = source.slice(source.indexOf(",") + 1);
  const bytes = Buffer.from(encoded, "base64");
  const image = await decodeWebp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return `data:image/png;base64,${encodePng(image.width, image.height, image.data).toString("base64")}`;
}

const iconCache = new Map();

async function iconPng(mark, color) {
  if (typeof mark !== "string" || (!mark.startsWith("si:") && !mark.startsWith("lu:"))) return null;
  const key = `${mark}|${color}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const svg = iconSvg(mark.slice(3), mark.startsWith("lu:"), color);
  if (!svg) {
    iconCache.set(key, null);
    return null;
  }
  await ensureWasm();
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: 64 } }).render();
  const png = `data:image/png;base64,${Buffer.from(rendered.asPng()).toString("base64")}`;
  rendered.free();
  iconCache.set(key, png);
  return png;
}

function iconSvg(name, strokeIcon, color) {
  if (strokeIcon) {
    const nodes = LUCIDE[name];
    if (!nodes) return "";
    const body = nodes
      .map(([type, props]) => `<${type} ${Object.entries(props).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`)
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }
  if (STROKE_MARKS[name]) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${STROKE_MARKS[name]}"/></svg>`;
  }
  const path = SIMPLE[name];
  if (!path) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`;
}

function cardImage(doc, picture) {
  const colors = palette(doc.accent || "#f5d8da");
  const items = (Array.isArray(doc.items) ? doc.items : []).map((item) => ({
    label: plain(item?.label),
    detail: plain(item?.detail),
    image: picture ? item?.image || null : null,
    icon: item?.icon || null,
    mark: typeof item?.mark === "string" ? item.mark : "",
  }));
  const showAvatar = Boolean(picture && doc.pictureKind === "avatar" && doc.picture);
  const showPoster = Boolean(picture && doc.layout === "media" && doc.picture);

  return h(
    "div",
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        background: colors.background,
        padding: MARGIN,
        overflow: "hidden",
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
          width: FRAME,
          height: HEIGHT - MARGIN * 2,
          boxSizing: "border-box",
          background: colors.card,
          borderRadius: 28,
          padding: CARD_PAD,
          overflow: "hidden",
          border: `1px solid ${colors.line}`,
        },
      },
      header(doc, colors, showAvatar),
      doc.layout === "profile"
        ? h(
            "div",
            {
              style: {
                display: "flex",
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "center",
                width: INNER,
              },
            },
            doc.lede
              ? text(plain(doc.lede), {
                  width: INNER,
                  fontSize: 42,
                  lineHeight: 1.3,
                  textAlign: "center",
                  justifyContent: "center",
                  color: colors.ink,
                })
              : null,
          )
        : doc.lede
          ? text(plain(doc.lede), { width: INNER, fontSize: 28, lineHeight: 1.25, marginTop: 16, color: colors.ink })
          : null,
      doc.layout === "profile" ? chips(items, colors, true) : body(doc.layout, items, colors, showPoster ? doc.picture : null),
    ),
  );
}

function header(doc, colors, showAvatar) {
  const large = doc.layout === "profile";
  const handle = large ? plain(doc.lines?.[0]) : "";
  const avatar = large ? 176 : 112;
  const titleWidth = showAvatar ? INNER - avatar - 28 : INNER;
  const title = h(
    "div",
    { style: { display: "flex", flexDirection: "column", width: titleWidth } },
    text(plain(doc.kicker).toUpperCase(), { fontSize: large ? 20 : 18, letterSpacing: 2, color: colors.muted }),
    text(plain(doc.heading), { width: titleWidth, fontSize: large ? 64 : 48, lineHeight: 1.05, marginTop: 8 }),
    handle.startsWith("@") ? text(handle, { fontSize: 30, marginTop: 8, color: colors.muted }) : null,
  );
  if (!showAvatar) return title;
  return h(
    "div",
    { style: { display: "flex", alignItems: "center", width: INNER } },
    h("img", {
      src: doc.picture,
      width: avatar,
      height: avatar,
      style: { borderRadius: avatar / 2, marginRight: 28, objectFit: "cover" },
    }),
    title,
  );
}

function body(layout, items, colors, poster) {
  if (layout === "profile") return chips(items, colors);
  if (layout === "tiles") return tiles(items, colors);
  if (layout === "media") return shelf(items, colors, poster);
  if (layout === "specs") return specs(items, colors);
  if (layout === "activity") return activity(items, colors);
  return rows(items, colors);
}

function chips(items, colors, alongBottom = false) {
  const shown = items.filter((item) => item.label).slice(0, 6);
  if (shown.length === 0) return null;
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: alongBottom ? "center" : "flex-start",
        width: INNER,
        marginTop: alongBottom ? 0 : 22,
      },
    },
    ...shown.map((item) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            background: colors.tile,
            borderRadius: 999,
            padding: "10px 16px",
            marginRight: 12,
            marginBottom: 12,
            fontSize: 22,
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
    { style: { display: "flex", flexDirection: "column", width: INNER, marginTop: 22 } },
    ...items.slice(0, 5).map((item) => {
      const lead = item.image || item.icon ? 58 : 0;
      const copy = INNER - 32 - lead;
      return h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            width: INNER,
            boxSizing: "border-box",
            background: colors.tile,
            borderRadius: 18,
            padding: "10px 14px",
            marginBottom: 10,
            overflow: "hidden",
          },
        },
        item.image
          ? h("img", {
              src: item.image,
              width: 46,
              height: 46,
              style: { borderRadius: 23, marginRight: 12, objectFit: "cover" },
            })
          : iconBox(item.icon, colors),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", width: copy } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", width: copy } },
            text(item.label, { fontSize: 24, lineHeight: 1.2 }),
            statusDot(item.mark),
          ),
          item.detail ? text(item.detail, { width: copy, fontSize: 18, lineHeight: 1.3, marginTop: 2, color: colors.muted }) : null,
        ),
      );
    }),
  );
}

function specs(items, colors) {
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", width: INNER, marginTop: 22 } },
    ...items.slice(0, 6).map((item, index) => {
      const copy = TILE - 24 - 54;
      const [value, extra] = splitDetail(item.detail);
      return h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            width: TILE,
            boxSizing: "border-box",
            background: colors.tile,
            borderRadius: 18,
            padding: 12,
            marginRight: index % 2 === 0 ? GAP : 0,
            marginBottom: GAP,
            overflow: "hidden",
          },
        },
        iconBox(item.icon, colors),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", width: copy } },
          text(item.label.toUpperCase(), { width: copy, fontSize: 14, letterSpacing: 1, color: colors.muted }),
          text(value, { width: copy, fontSize: 22, lineHeight: 1.2, marginTop: 2 }),
          extra ? text(extra, { width: copy, fontSize: 16, marginTop: 2, color: colors.muted }) : null,
        ),
      );
    }),
  );
}

function activity(items, colors) {
  const status = items[0];
  const now = items[1];
  const art = now?.image ? 88 : 0;
  const copy = INNER - 28 - art - (art ? 16 : 0);
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", width: INNER, marginTop: 22 } },
    status
      ? h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              background: colors.tile,
              borderRadius: 999,
              padding: "8px 14px",
              marginBottom: 12,
            },
          },
          statusDot(status.mark, 0),
          text(status.label, { fontSize: 22, marginLeft: 8 }),
        )
      : null,
    status?.detail
      ? h(
          "div",
          {
            style: {
              display: "flex",
              width: INNER,
              boxSizing: "border-box",
              background: colors.tile,
              borderRadius: 16,
              padding: "12px 14px",
              marginBottom: 12,
            },
          },
          text(status.detail, { width: INNER - 28, fontSize: 22 }),
        )
      : null,
    now
      ? h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              width: INNER,
              boxSizing: "border-box",
              background: colors.tile,
              borderRadius: 22,
              padding: 14,
              overflow: "hidden",
            },
          },
          now.image
            ? h("img", {
                src: now.image,
                width: 88,
                height: 88,
                style: { borderRadius: 12, objectFit: "cover", marginRight: 16 },
              })
            : null,
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", width: copy } },
            now.mark ? text(now.mark.toUpperCase(), { width: copy, fontSize: 16, letterSpacing: 1, color: colors.muted }) : null,
            text(now.label, { width: copy, fontSize: 30, lineHeight: 1.15, marginTop: now.mark ? 6 : 0 }),
            now.detail ? text(now.detail, { width: copy, fontSize: 20, marginTop: 6, color: colors.muted }) : null,
          ),
        )
      : null,
  );
}

function tiles(items, colors) {
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", width: INNER, marginTop: 22 } },
    ...items.slice(0, 6).map((item, index) => {
      const copy = TILE - 24 - (item.image ? 76 : 0);
      return h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            width: TILE,
            boxSizing: "border-box",
            background: colors.tile,
            borderRadius: 18,
            padding: 12,
            marginRight: index % 2 === 0 ? GAP : 0,
            marginBottom: GAP,
            overflow: "hidden",
          },
        },
        item.image
          ? h("img", {
              src: item.image,
              width: 64,
              height: 64,
              style: { borderRadius: 14, marginRight: 12, objectFit: "cover" },
            })
          : null,
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", width: copy, overflow: "hidden" } },
          text(item.label, { width: copy, fontSize: 24, lineHeight: 1.2 }),
          item.detail ? text(item.detail, { width: copy, fontSize: 18, lineHeight: 1.3, marginTop: 4, color: colors.muted }) : null,
        ),
      );
    }),
  );
}

function shelf(items, colors, poster) {
  const list = poster ? INNER - 214 : INNER;
  return h(
    "div",
    { style: { display: "flex", width: INNER, marginTop: 22 } },
    poster
      ? h("img", {
          src: poster,
          width: 190,
          height: 280,
          style: { borderRadius: 16, objectFit: "cover", marginRight: 24 },
        })
      : null,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", width: list } },
      ...items.slice(0, 4).map((item) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              width: list,
              boxSizing: "border-box",
              background: colors.tile,
              borderRadius: 16,
              padding: "10px 14px",
              marginBottom: 10,
              overflow: "hidden",
            },
          },
          item.image && item.image !== poster
            ? h("img", {
                src: item.image,
                width: 36,
                height: 52,
                style: { borderRadius: 8, objectFit: "cover", marginRight: 12 },
              })
            : null,
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", width: list - 28 - (item.image && item.image !== poster ? 48 : 0) } },
            text(item.label, { width: list - 80, fontSize: 24, lineHeight: 1.2 }),
            item.detail ? text(item.detail, { width: list - 80, fontSize: 18, marginTop: 4, color: colors.muted }) : null,
          ),
        ),
      ),
    ),
  );
}

function text(value, style) {
  return h("div", { style: { display: "flex", overflow: "hidden", ...style } }, value);
}

function h(type, props, ...children) {
  return React.createElement(type, props, ...children.filter((child) => child !== null && child !== undefined && child !== ""));
}

function palette(seed) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(seed) ? seed : "#f5d8da";
  const source = Hct.fromInt(argbFromHex(safe));
  const hue = source.hue;
  const scheme = new DynamicScheme({
    sourceColorArgb: source.toInt(),
    variant: 3,
    contrastLevel: 0,
    isDark: true,
    primaryPalette: TonalPalette.fromHueAndChroma(hue, 200),
    secondaryPalette: TonalPalette.fromHueAndChroma(hue, 36),
    tertiaryPalette: TonalPalette.fromHueAndChroma((hue + 14) % 360, 52),
    neutralPalette: TonalPalette.fromHueAndChroma(hue, 8),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(hue, 10),
  });
  const surface = (argb) => hexFromArgb(Hct.from(hue, 24, Hct.fromInt(argb).tone).toInt());
  return {
    background: surface(scheme.background),
    card: surface(scheme.surfaceContainerLow),
    tile: surface(scheme.surfaceContainerHigh),
    ink: hexFromArgb(scheme.onSurface),
    muted: hexFromArgb(scheme.onSurfaceVariant),
    line: hexFromArgb(scheme.outlineVariant),
    accent: hexFromArgb(scheme.primaryContainer),
    onAccent: hexFromArgb(scheme.onPrimaryContainer),
  };
}

const STATUS_COLOR = {
  online: "#3ba55d",
  idle: "#f0b232",
  dnd: "#ed4245",
  offline: "#80848e",
};

const STROKE_MARKS = {
  link: "M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1",
  mail: "M3 5h18v14H3V5zm0 0 9 7 9-7",
};

function statusDot(mark, marginLeft = 8) {
  const status = mark.startsWith("st:") ? mark.slice(3) : "";
  const color = STATUS_COLOR[status];
  if (!color) return null;
  return h("div", {
    style: { width: 12, height: 12, borderRadius: 6, background: color, marginLeft, flex: "none" },
  });
}

function iconBox(icon, colors) {
  if (!icon) return null;
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 42,
        height: 42,
        background: colors.accent,
        marginRight: 12,
        flex: "none",
      },
    },
    h("img", { src: icon, width: 22, height: 22 }),
  );
}

function splitDetail(value) {
  const split = value.indexOf(" · ");
  if (split === -1) return [value, ""];
  return [value.slice(0, split), value.slice(split + 3)];
}

function plain(value) {
  return String(value ?? "")
    .replace(/[^\u0020-\u024F\u2013\u2014\u2018\u2019\u201C\u201D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), row + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(checksum(body));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, body, crc]);
}

function checksum(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
