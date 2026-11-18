import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

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
        if (pathname !== "/api/config" && pathname !== "/api/guestbook" && pathname !== "/api/discord" && pathname !== "/api/media") {
          next();
          return;
        }

        void handle(server, req, res, pathname).catch((error: unknown) => {
          console.error("[vite] local API failed", error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Local API failed." }));
          }
        });
      });
    },
  };
}

async function handle(
  server: { ssrLoadModule: (url: string) => Promise<Record<string, unknown>> },
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) {
  const modules: Record<string, string> = {
    "/api/config": "/api/config.ts",
    "/api/guestbook": "/api/guestbook.ts",
    "/api/discord": "/api/discord.ts",
    "/api/media": "/api/media.ts",
  };
  const mod = await server.ssrLoadModule(modules[pathname] ?? "/api/config.ts");
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
