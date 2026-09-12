import { cleanTrip, publicationIssues } from "./validation.js";
import { lookup, APIError } from "./aero.js";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra,
    },
  });
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
async function hash(s) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
function equal(a, b) {
  let n = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
}
async function body(req) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new APIError("JSON request required.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new APIError("Request body required.");
  const chunks = [];
  let length = 0,
    done = false;
  for (let i = 0; i < 10000; i++) {
    const r = await reader.read();
    if (r.done) {
      done = true;
      break;
    }
    length += r.value.length;
    if (length > 500000) {
      await reader.cancel();
      throw new APIError("This trip exceeds the 500 KB save limit.", 413);
    }
    chunks.push(r.value);
  }
  if (!done) {
    await reader.cancel();
    throw new APIError("Too many request chunks.", 413);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new APIError("Invalid JSON.");
  }
}
function sessionCookie(req, token, maxAge) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `flight_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function auth(req, env) {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)flight_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token || !env.ADMIN_PASSCODE) return false;
  const row = await env.DB.prepare(
    "SELECT passcode_hash FROM sessions WHERE token_hash=? AND expires_at>?",
  )
    .bind(await hash(token), Date.now())
    .first();
  return row && equal(row.passcode_hash, await hash(env.ADMIN_PASSCODE));
}
const view = (r) => ({
  id: r.id,
  trip: JSON.parse(r.draft),
  revision: r.revision,
  shareToken: r.share_token,
  updatedAt: r.updated_at,
  publishedAt: r.published_at,
});
export async function handleAPI(req, env) {
  try {
    if (!env.DB)
      return json(
        {
          error:
            "Database setup is incomplete. Add the DB binding and run the SQL migration.",
        },
        503,
      );
    const u = new URL(req.url),
      p = u.pathname.split("/").filter(Boolean).slice(1),
      method = req.method;
    if (
      !["GET", "HEAD"].includes(method) &&
      req.headers.get("origin") !== u.origin
    )
      return json({ error: "Request origin must match this site." }, 403);
    if (p[0] === "share" && method === "GET") {
      if (!/^[a-f0-9]{64}$/.test(p[1] || ""))
        return json({ error: "This proposal is unavailable." }, 404);
      const row = await env.DB.prepare(
        "SELECT published,published_at FROM trips WHERE share_token=? AND published IS NOT NULL",
      )
        .bind(p[1])
        .first();
      return row
        ? json({
            trip: JSON.parse(row.published),
            publishedAt: row.published_at,
          })
        : json(
            {
              error:
                "This proposal is not published or the link has been revoked.",
            },
            404,
          );
    }
    if (p[0] === "login" && method === "POST") {
      if (!env.ADMIN_PASSCODE || env.ADMIN_PASSCODE.length < 12)
        return json(
          {
            error:
              "Set ADMIN_PASSCODE to at least 12 characters in Cloudflare secrets.",
          },
          503,
        );
      const data = await body(req),
        now = Date.now(),
        key = await hash(req.headers.get("cf-connecting-ip") || "local");
      const limit = await env.DB.prepare(
        "INSERT INTO login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING attempts,expires_at",
      )
        .bind(key, now + 900000, now, now)
        .first();
      if (limit.attempts > 10)
        return json(
          { error: "Too many passcode attempts. Try again in 15 minutes." },
          429,
          { "Retry-After": "900" },
        );
      const pass = typeof data.passcode === "string" ? data.passcode : "";
      if (
        pass.length > 1000 ||
        !equal(await hash(pass), await hash(env.ADMIN_PASSCODE))
      )
        return json({ error: "Incorrect passcode." }, 401);
      const token = random();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO sessions(token_hash,passcode_hash,expires_at) VALUES(?,?,?)",
        ).bind(
          await hash(token),
          await hash(env.ADMIN_PASSCODE),
          now + 43200000,
        ),
        env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now),
        env.DB.prepare("DELETE FROM login_limits WHERE expires_at<?").bind(now),
        env.DB.prepare("DELETE FROM api_cache WHERE expires_at<?").bind(now),
        env.DB.prepare("DELETE FROM api_locks WHERE expires_at<?").bind(now),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie(req, token, 43200),
      });
    }
    if (!(await auth(req, env)))
      return json({ error: "Please sign in with your admin passcode." }, 401);
    if (p[0] === "session" && method === "GET")
      return json({ ok: true, aeroConfigured: !!env.FLIGHTAWARE_API_KEY });
    if (p[0] === "logout" && method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.match(/flight_session=([a-f0-9]{64})/)?.[1];
      if (token)
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await hash(token))
          .run();
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie(req, "", 0),
      });
    }
    if (p[0] === "lookup" && method === "POST")
      return json(await lookup(env, await body(req)));
    if (p[0] !== "trips") return json({ error: "Not found." }, 404);
    if (!p[1]) {
      if (method === "GET") {
        const page = Math.max(
          0,
          Math.min(10000, Math.floor(Number(u.searchParams.get("page")) || 0)),
        );
        const rows = await env.DB.prepare(
          "SELECT id,json_extract(draft,'$.title') AS title,json_extract(draft,'$.origin') AS origin,json_extract(draft,'$.destination') AS destination,json_extract(draft,'$.travelers') AS travelers,json_extract(draft,'$.dateSets') AS dateSets,json_array_length(draft,'$.options') AS optionCount,updated_at,published_at FROM trips ORDER BY updated_at DESC LIMIT 51 OFFSET ?",
        )
          .bind(page * 50)
          .all();
        return json({
          trips: rows.results.slice(0, 50),
          more: rows.results.length > 50,
          page,
        });
      }
      if (method === "POST") {
        const trip = cleanTrip(await body(req)),
          id = crypto.randomUUID(),
          now = new Date().toISOString(),
          token = random();
        await env.DB.prepare(
          "INSERT INTO trips(id,draft,share_token,updated_at) VALUES(?,?,?,?)",
        )
          .bind(id, JSON.stringify(trip), token, now)
          .run();
        return json(
          {
            id,
            trip,
            revision: 1,
            shareToken: token,
            updatedAt: now,
            publishedAt: null,
          },
          201,
        );
      }
    }
    const row = await env.DB.prepare("SELECT * FROM trips WHERE id=?")
      .bind(p[1] || "")
      .first();
    if (!row) return json({ error: "Trip not found." }, 404);
    if (method === "GET" && !p[2]) return json(view(row));
    const data = await body(req);
    if (!Number.isInteger(data.revision) || data.revision !== row.revision)
      return json(
        {
          error:
            "This trip changed in another tab. Copy any unsaved details, then reload before saving.",
        },
        409,
      );
    if (method === "PUT" && !p[2]) {
      const trip = cleanTrip(data.trip),
        now = new Date().toISOString();
      const result = await env.DB.prepare(
        "UPDATE trips SET draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING *",
      )
        .bind(JSON.stringify(trip), now, row.id, data.revision)
        .first();
      return result
        ? json(view(result))
        : json(
            { error: "Save conflict. Reload this trip before continuing." },
            409,
          );
    }
    if (method === "POST" && p[2] === "publish") {
      const issues = publicationIssues(cleanTrip(JSON.parse(row.draft)));
      if (issues.length)
        return json(
          { error: "Complete these details before publishing.", issues },
          422,
        );
      const result = await env.DB.prepare(
        "UPDATE trips SET published=draft,published_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING *",
      )
        .bind(new Date().toISOString(), row.id, data.revision)
        .first();
      return result
        ? json(view(result))
        : json({ error: "Publish conflict. Reload this trip." }, 409);
    }
    if (method === "POST" && p[2] === "unpublish") {
      const result = await env.DB.prepare(
        "UPDATE trips SET published=NULL,published_at=NULL,revision=revision+1 WHERE id=? AND revision=? RETURNING *",
      )
        .bind(row.id, data.revision)
        .first();
      return result
        ? json(view(result))
        : json({ error: "Update conflict. Reload this trip." }, 409);
    }
    if (method === "POST" && p[2] === "rotate-link") {
      const result = await env.DB.prepare(
        "UPDATE trips SET share_token=?,revision=revision+1 WHERE id=? AND revision=? RETURNING *",
      )
        .bind(random(), row.id, data.revision)
        .first();
      return result
        ? json(view(result))
        : json({ error: "Update conflict. Reload this trip." }, 409);
    }
    if (method === "DELETE" && !p[2]) {
      const result = await env.DB.prepare(
        "DELETE FROM trips WHERE id=? AND revision=? RETURNING id",
      )
        .bind(row.id, data.revision)
        .first();
      return result
        ? json({ ok: true })
        : json({ error: "Delete conflict. Reload this trip." }, 409);
    }
    return json({ error: "Method not allowed." }, 405);
  } catch (e) {
    if (e instanceof APIError)
      return json(
        { error: e.message, retryAfter: e.retryAfter },
        e.status,
        e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {},
      );
    if (/D1|SQLITE|no such table/i.test(e.message || ""))
      return json(
        {
          error:
            "Database setup is incomplete or temporarily unavailable. Check the DB binding and run the included SQL migration.",
        },
        503,
      );
    return json(
      { error: e.message || "The request could not be completed." },
      400,
    );
  }
}
