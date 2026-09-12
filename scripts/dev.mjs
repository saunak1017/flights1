import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { Readable } from "node:stream";
import { localDB } from "./sqlite-adapter.mjs";
import { handleAPI } from "../server/api.js";
try {
  process.loadEnvFile(".dev.vars");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const DB = localDB(process.env.LOCAL_DB || "local.sqlite");
DB.exec(await readFile("migrations/0001_initial.sql", "utf8"));
const env = {
  DB,
  ADMIN_PASSCODE: process.env.ADMIN_PASSCODE,
  FLIGHTAWARE_API_KEY: process.env.FLIGHTAWARE_API_KEY,
};
const root = resolve("public"),
  port = Number(process.env.PORT || 8788);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname.startsWith("/api/")) {
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(!["GET", "HEAD"].includes(req.method)
            ? { body: Readable.toWeb(req), duplex: "half" }
            : {}),
        });
        const response = await handleAPI(request, env);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const name = resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!name.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const b = await readFile(name);
      res.writeHead(200, {
        "Content-Type": types[extname(name)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(b);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Flight proposals: http://localhost:${port}. Local SQLite storage; configure ADMIN_PASSCODE in .dev.vars (12+ characters).`,
    ),
  );
