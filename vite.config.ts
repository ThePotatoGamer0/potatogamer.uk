import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import { applyOg, isOgPath, type OgDocument } from "./shared/og";

function localApi(): Plugin {
  return {
    name: "potatogamer-local-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname === "/api/og") {
          void serveOgImage(server, req, res).catch((error: unknown) => {
            console.error("[vite] og image failed", error);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.end("Could not render that preview.");
            }
          });
          return;
        }

        if (API_MODULES[pathname]) {
          void handle(server, req, res, pathname).catch((error: unknown) => {
            console.error("[vite] local API failed", error);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Local API failed." }));
            }
          });
          return;
        }

        if ((req.method === "GET" || req.method === "HEAD") && isOgPath(pathname)) {
          void serveOgHtml(server, req, res).catch((error: unknown) => {
            console.error("[vite] og html failed", error);
            if (!res.headersSent) next();
          });
          return;
        }

        next();
      });
    },
  };
}

const API_MODULES: Record<string, string> = {
  "/api/config": "/api/config.ts",
  "/api/guestbook": "/api/guestbook.ts",
  "/api/discord": "/api/discord.ts",
  "/api/media": "/api/media.ts",
};

async function serveOgImage(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method not allowed.");
    return;
  }
  const mod = (await server.ssrLoadModule("/api/_lib/ogDocument.ts")) as {
    buildOgDocument: (request: Request) => Promise<OgDocument>;
  };
  const doc = await mod.buildOgDocument(await toRequest(req));
  const rendererHref = pathToFileURL(path.join(server.config.root, "api/_lib/ogImage.mjs")).href;
  const renderer = (await import(rendererHref)) as { renderOgImage: (document: OgDocument) => Promise<Buffer> };
  const body = await renderer.renderOgImage(doc);
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", body.length);
  res.end(req.method === "HEAD" ? undefined : body);
}

async function serveOgHtml(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const raw = await readFile(fileURLToPath(new URL("./index.html", import.meta.url)), "utf8");
  const transformed = await server.transformIndexHtml(req.url ?? "/", raw);
  const mod = (await server.ssrLoadModule("/api/_lib/ogDocument.ts")) as {
    buildOgDocument: (request: Request) => Promise<OgDocument>;
  };
  const doc = await mod.buildOgDocument(await toRequest(req));
  const html = applyOg(transformed, doc);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(html);
}

async function handle(
  server: { ssrLoadModule: (url: string) => Promise<Record<string, unknown>> },
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) {
  const mod = await server.ssrLoadModule(API_MODULES[pathname] ?? "/api/config.ts");
  const method = req.method ?? "GET";
  const handler = mod[method];
  if (typeof handler !== "function") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  const response = await (handler as (request: Request) => Promise<Response>)(await toRequest(req));
  await writeResponse(res, response);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

async function writeResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
}

export default defineConfig({
  appType: "spa",
  plugins: [react(), localApi()],
  server: {
    port: 5173,
    // Quick Cloudflare tunnels send the public hostname. Allow those hosts in dev.
    allowedHosts: [".trycloudflare.com"],
  },
});
