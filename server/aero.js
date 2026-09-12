import {
  AIRLINES,
  AIRPORTS,
  flightIdent,
  validDate,
  addDays,
  localParts,
  newSegment,
  zoneValid,
} from "../public/core.js";
export class APIError extends Error {
  constructor(message, status = 400, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function cached(env, key) {
  const r = await env.DB.prepare(
    "SELECT value FROM api_cache WHERE key=? AND expires_at>?",
  )
    .bind(key, Date.now())
    .first();
  return r ? JSON.parse(r.value) : null;
}
async function cache(env, key, data, ttl) {
  await env.DB.prepare(
    "INSERT INTO api_cache(key,value,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at",
  )
    .bind(key, JSON.stringify(data), Date.now() + ttl)
    .run();
}
async function reserve(env) {
  const now = Date.now();
  const r = await env.DB.prepare(
    "UPDATE api_gate SET next_at=MAX(next_at,?)+7000 WHERE id=1 AND next_at<=? RETURNING next_at",
  )
    .bind(now, now + 14000)
    .first();
  if (!r)
    throw new APIError(
      "Flight lookups are cooling down. Your entered details are safe; retry shortly.",
      429,
      20,
    );
  const delay = r.next_at - 7000 - now;
  if (delay > 0) await sleep(delay);
}
async function get(env, path) {
  const key = "raw:" + path,
    old = await cached(env, key);
  if (old) return old;
  if ((env.lookupCalls || 0) >= 8)
    throw new APIError(
      "This lookup needs too many additional airport queries. Enter the route manually or retry to reuse the cached airport information.",
      422,
    );
  env.lookupCalls = (env.lookupCalls || 0) + 1;
  await reserve(env);
  let response;
  try {
    response = await fetch("https://aeroapi.flightaware.com/aeroapi" + path, {
      headers: {
        "x-apikey": env.FLIGHTAWARE_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(18000),
    });
  } catch {
    throw new APIError(
      "FlightAware did not respond in time. Retry or enter the flight manually.",
      502,
    );
  }
  if (response.status === 429) {
    const header = response.headers.get("retry-after"),
      seconds = Number(header);
    const delay = Math.max(
      15,
      Math.min(
        300,
        Number.isFinite(seconds) && seconds > 0
          ? seconds
          : (Date.parse(header) - Date.now()) / 1000 || 60,
      ),
    );
    await env.DB.prepare(
      "UPDATE api_gate SET next_at=MAX(next_at,?) WHERE id=1",
    )
      .bind(Date.now() + delay * 1000)
      .run();
    throw new APIError(
      "FlightAware has reached its rate limit. Please retry after the cooldown; manual entry remains available.",
      429,
      Math.ceil(delay),
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new APIError(
      "FlightAware rejected the key or this endpoint is unavailable on your plan. Check the AeroAPI key and schedule access in your FlightAware account.",
      422,
    );
  if (!response.ok) {
    if (response.status === 400 || response.status === 404)
      throw new APIError(
        "FlightAware could not serve this flight/date query. Check the identifier and schedule range, or use manual entry.",
        422,
      );
    throw new APIError(
      "FlightAware is temporarily unavailable. Retry or enter the flight manually.",
      502,
    );
  }
  const data = await response.json();
  await cache(env, key, data, 3600000);
  return data;
}
async function airport(env, raw) {
  const obj = typeof raw === "object" && raw ? raw : {};
  const code = obj.code_iata || obj.code || raw || "";
  if (typeof code !== "string" || !code)
    throw new APIError(
      "FlightAware omitted an airport. Enter this flight manually.",
      422,
    );
  let zone = obj.timezone || AIRPORTS[code]?.[1];
  if (zone && zoneValid(zone))
    return {
      code: obj.code_iata || code,
      zone,
      name: obj.name || AIRPORTS[code]?.[0] || code,
    };
  const data = await get(env, "/airports/" + encodeURIComponent(code));
  zone = data.timezone;
  if (!zoneValid(zone))
    throw new APIError(
      `No timezone was available for ${code}. Enter the airport timezone manually.`,
      422,
    );
  return {
    code: data.code_iata || obj.code_iata || code,
    zone,
    name: data.name || code,
  };
}
export function schedulePath(
  ident,
  date,
  cursor = "",
  today = new Date().toISOString().slice(0, 10),
) {
  const query = new URLSearchParams({
    airline: ident.icao || ident.iata,
    flight_number: ident.number,
    max_pages: "1",
  });
  if (cursor) query.set("cursor", cursor);
  const earliest = addDays(today, -90),
    latest = addDays(today, 365);
  const start = addDays(date, -1) < earliest ? earliest : addDays(date, -1);
  const end =
    addDays(date, 2) > latest ? latest + "T23:59:59Z" : addDays(date, 2);
  return `/schedules/${start}/${end}?${query}`;
}
export async function normalizeFlight(raw, ident, date, resolveAirport) {
  const origin = await resolveAirport(raw.origin),
    destination = await resolveAirport(raw.destination),
    dep = raw.scheduled_out,
    arr = raw.scheduled_in;
  if (!dep || !arr) return null;
  const d = localParts(dep, origin.zone),
    a = localParts(arr, destination.zone);
  if (d.date !== date) return null;
  const op = raw.operator_iata || raw.operator || "",
    operating = AIRLINES.find((x) => x[0] === op || x[1] === op);
  return {
    ...newSegment(date),
    flight: ident.display,
    iata: ident.iata,
    airline: ident.airline,
    operatedBy:
      operating && operating[0] !== ident.iata
        ? operating[2]
        : op && op !== ident.icao && op !== ident.iata
          ? op
          : "",
    origin: origin.code,
    destination: destination.code,
    depDate: d.date,
    depTime: d.time,
    depZone: origin.zone,
    depUTC: dep,
    arrDate: a.date,
    arrTime: a.time,
    arrZone: destination.zone,
    arrUTC: arr,
    aircraft: raw.aircraft_type || "",
    alliance: ident.alliance,
    verified: true,
    source: "FlightAware schedule",
    fetchedAt: new Date().toISOString(),
  };
}
export async function lookup(env, input) {
  env = { ...env, lookupCalls: 0 };
  if (!env.FLIGHTAWARE_API_KEY)
    throw new APIError(
      "Add FLIGHTAWARE_API_KEY to your Cloudflare secrets to enable lookups. Manual entry works now.",
      422,
    );
  if (!validDate(input.date))
    throw new APIError("Enter a valid local departure date.");
  const today = new Date().toISOString().slice(0, 10);
  if (input.date > addDays(today, 365) || input.date < addDays(today, -90))
    throw new APIError(
      "Schedule lookup supports dates within 365 days ahead and 90 days back. You can still enter other dates manually.",
    );
  let ident = flightIdent(input.flight);
  const key = `lookup:${ident.icao || ident.iata}${ident.number}:${input.date}`,
    old = await cached(env, key);
  if (old) return { ...old, cached: true };
  const lock = await env.DB.prepare(
    "INSERT INTO api_locks(key,expires_at) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at WHERE api_locks.expires_at<? RETURNING key",
  )
    .bind(key, Date.now() + 180000, Date.now())
    .first();
  if (!lock)
    throw new APIError(
      "This flight is already being looked up. Retry shortly to use the saved result.",
      429,
      10,
    );
  try {
    if (!ident.icao) {
      const op = await get(env, "/operators/" + encodeURIComponent(ident.iata));
      if (!op.icao)
        throw new APIError(
          "FlightAware could not resolve this airline. Try its three-letter ICAO flight number or enter manually.",
          422,
        );
      ident = { ...ident, icao: op.icao, airline: op.name || ident.airline };
    } else if (!ident.iata) {
      const op = await get(env, "/operators/" + encodeURIComponent(ident.icao));
      ident = {
        ...ident,
        iata: op.iata || "",
        airline: op.name || ident.airline,
        display: (op.iata || ident.icao) + ident.number,
      };
    }
    let cursor = "",
      more = false,
      flights = [],
      missing = 0;
    for (let page = 0; page < 3; page++) {
      const data = await get(env, schedulePath(ident, input.date, cursor));
      if (!Array.isArray(data.scheduled))
        throw new APIError(
          "FlightAware returned an unexpected schedule format. Use manual entry and check the integration.",
          502,
        );
      for (const raw of data.scheduled.slice(0, 100)) {
        const normalized = await normalizeFlight(raw, ident, input.date, (x) =>
          airport(env, x),
        );
        if (normalized) flights.push(normalized);
        else if (!raw.scheduled_out || !raw.scheduled_in) missing++;
      }
      const next = data.links?.next;
      more = !!next;
      if (!next || flights.length) break;
      cursor =
        new URL(next, "https://aeroapi.flightaware.com").searchParams.get(
          "cursor",
        ) || "";
      if (!cursor) break;
    }
    flights = [
      ...new Map(
        flights.map((f) => [
          `${f.origin}|${f.destination}|${f.depUTC}|${f.arrUTC}`,
          f,
        ]),
      ).values(),
    ];
    const result = {
      flights,
      cached: false,
      more,
      message: flights.length
        ? more
          ? "Results may be partial; choose the matching route. If it is missing, use manual entry."
          : "Choose the flight that matches your itinerary."
        : `No matching schedule was returned for that local departure date.${missing ? " Some results lacked complete times." : ""}${more ? " The bounded result limit was reached." : ""} Try another date or enter manually; future schedule coverage depends on the airline and account.`,
    };
    await cache(env, key, result, flights.length ? 3600000 : 300000);
    return result;
  } finally {
    await env.DB.prepare("DELETE FROM api_locks WHERE key=?").bind(key).run();
  }
}
