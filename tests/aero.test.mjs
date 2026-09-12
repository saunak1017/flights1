import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localDB } from "../scripts/sqlite-adapter.mjs";
import { lookup } from "../server/aero.js";
import { addDays } from "../public/core.js";
const schema = await readFile(
  new URL("../migrations/0001_initial.sql", import.meta.url),
  "utf8",
);
function setup() {
  const DB = localDB();
  DB.exec(schema);
  return { DB, FLIGHTAWARE_API_KEY: "test-key-not-real" };
}
const date = addDays(new Date().toISOString().slice(0, 10), 60);
const row = {
  origin: { code_iata: "JFK", timezone: "America/New_York" },
  destination: { code_iata: "MUC", timezone: "Europe/Berlin" },
  scheduled_out: date + "T15:00:00Z",
  scheduled_in: addDays(date, 1) + "T00:00:00Z",
  aircraft_type: "B789",
};
test("lookup uses API key server-side and repeated IATA/ICAO lookup shares cache", async () => {
  const env = setup(),
    original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.ok(url.includes("/schedules/"));
    assert.equal(options.headers["x-apikey"], "test-key-not-real");
    return Response.json({ scheduled: [row], links: { next: null } });
  };
  try {
    const a = await lookup(env, { flight: "LH413", date });
    assert.equal(a.flights.length, 1);
    assert.equal(a.flights[0].depDate, date);
    const b = await lookup(env, { flight: "DLH413", date });
    assert.equal(b.cached, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
    env.DB.close();
  }
});
test("external 429 installs a shared cooldown and releases lookup lock", async () => {
  const env = setup(),
    original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { error: "limit" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  try {
    await assert.rejects(
      () => lookup(env, { flight: "LH413", date }),
      (err) => err.status === 429 && err.retryAfter === 60,
    );
    const gate = await env.DB.prepare("SELECT next_at FROM api_gate").first();
    assert.ok(gate.next_at > Date.now() + 50000);
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS count FROM api_locks").first())
        .count,
      0,
    );
  } finally {
    globalThis.fetch = original;
    env.DB.close();
  }
});
test("account access failure is distinct from an empty schedule", async () => {
  const env = setup(),
    original = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 403 });
  try {
    await assert.rejects(
      () => lookup(env, { flight: "LH413", date }),
      (err) => err.status === 422 && err.message.includes("plan"),
    );
  } finally {
    globalThis.fetch = original;
    env.DB.close();
  }
});
test("no matching local date never imports an adjacent day", async () => {
  const env = setup(),
    original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      scheduled: [{ ...row, scheduled_out: addDays(date, -1) + "T15:00:00Z" }],
    });
  try {
    const r = await lookup(env, { flight: "LH413", date });
    assert.equal(r.flights.length, 0);
    assert.match(r.message, /No matching schedule/);
  } finally {
    globalThis.fetch = original;
    env.DB.close();
  }
});
