import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
  const showAvatar = Boolean(picture && doc.pictureKind === "avatar" && doc.picture);
  const showPoster = Boolean(picture && doc.pictureKind === "poster" && doc.picture);
  const heading = [
    showAvatar
      ? React.createElement("img", {
          src: doc.picture,
          width: 112,
          height: 112,
          style: { borderRadius: 56, marginRight: 28 },
        })
      : null,
    React.createElement("div", { style: { display: "flex", fontSize: 64, lineHeight: 1.05 } }, plain(doc.heading)),
  ].filter(Boolean);

  const lines = (Array.isArray(doc.lines) ? doc.lines : []).map((line, index) =>
    React.createElement(
      "div",
      {
        key: String(index),
        style: { display: "flex", fontSize: 30, lineHeight: 1.35, marginTop: index === 0 ? 0 : 10, color: "#3c3830" },
      },
      plain(line),
    ),
  );

  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fff8f3",
        color: "#1d1c16",
        fontFamily: "Geist",
      },
    },
    React.createElement("div", { style: { height: 16, width: "100%", background: doc.accent || "#E39B12", display: "flex" } }),
    React.createElement(
      "div",
      { style: { display: "flex", flex: 1, padding: "52px 68px 60px" } },
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", flex: 1 } },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", color: "#6f675c", fontSize: 24, letterSpacing: 3 } },
          React.createElement("div", null, "POTATOGAMER.UK"),
          React.createElement("div", null, plain(doc.kicker).toUpperCase()),
        ),
        React.createElement("div", { style: { display: "flex", alignItems: "center", marginTop: 28 } }, ...heading),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", marginTop: 28 } }, ...lines),
      ),
      showPoster
        ? React.createElement("img", {
            src: doc.picture,
            width: 250,
            height: 360,
            style: { marginLeft: 40, borderRadius: 24, objectFit: "cover" },
          })
        : null,
    ),
  );
}

function plain(value) {
  return String(value ?? "")
    .replace(/[^\u0020-\u024F\u2013\u2014\u2018\u2019\u201C\u201D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
