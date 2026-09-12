import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localDB } from "../scripts/sqlite-adapter.mjs";
import { handleAPI } from "../server/api.js";
const schema = await readFile(
  new URL("../migrations/0001_initial.sql", import.meta.url),
  "utf8",
);
function fixture() {
  return {
    title: "Winter trip",
    origin: "New York",
    destination: "Bombay",
    travelers: ["Saunak"],
    type: "roundtrip",
    dateSets: [{ departure: "2026-12-11", return: "2027-01-05" }],
    options: [
      {
        id: "opt",
        type: "oneway",
        title: "Flight",
        prices: [{ label: "Cash", cash: 620, currency: "USD" }],
        journeys: [
          {
            label: "Outbound",
            segments: [
              {
                id: "seg",
                flight: "AI119",
                origin: "BOM",
                destination: "JFK",
                depDate: "2026-12-11",
                depTime: "01:40",
                depZone: "Asia/Kolkata",
                arrDate: "2026-12-11",
                arrTime: "07:55",
                arrZone: "America/New_York",
                verified: true,
              },
            ],
          },
        ],
      },
    ],
  };
}
function setup() {
  const DB = localDB();
  DB.exec(schema);
  const env = { DB, ADMIN_PASSCODE: "test-private-passcode" };
  let cookie = "";
  const request = async (
    path,
    method = "GET",
    data,
    origin = "https://test.local",
  ) => {
    const r = await handleAPI(
      new Request("https://test.local/api/" + path, {
        method,
        headers: {
          Origin: origin,
          Cookie: cookie,
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      }),
      env,
    );
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  return { env, request, close: () => DB.close() };
}
test("auth protects trips and rejects cross-origin mutations", async () => {
  const x = setup();
  assert.equal((await x.request("trips")).status, 401);
  assert.equal(
    (
      await x.request(
        "login",
        "POST",
        { passcode: "test-private-passcode" },
        "https://evil.test",
      )
    ).status,
    403,
  );
  assert.equal(
    (await x.request("login", "POST", { passcode: "bad" })).status,
    401,
  );
  const r = await x.request("login", "POST", {
    passcode: "test-private-passcode",
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.equal((await x.request("trips")).status, 200);
  x.close();
});
test("draft/publish boundaries, optimistic concurrency, rotation, unpublish and delete", async () => {
  const x = setup();
  await x.request("login", "POST", { passcode: "test-private-passcode" });
  let r = await x.request("trips", "POST", fixture());
  assert.equal(r.status, 201);
  let record = r.data;
  const path = "trips/" + record.id,
    share = "share/" + record.shareToken;
  assert.equal((await x.request(share)).status, 404);
  r = await x.request(path + "/publish", "POST", { revision: record.revision });
  assert.equal(r.status, 200);
  record = r.data;
  assert.equal((await x.request(share)).data.trip.title, "Winter trip");
  const saved = await x.request(path, "PUT", {
    revision: record.revision,
    trip: { ...record.trip, title: "New draft" },
  });
  assert.equal(saved.status, 200);
  assert.equal((await x.request(share)).data.trip.title, "Winter trip");
  assert.equal(
    (
      await x.request(path, "PUT", {
        revision: record.revision,
        trip: record.trip,
      })
    ).status,
    409,
  );
  record = saved.data;
  record = (
    await x.request(path + "/publish", "POST", { revision: record.revision })
  ).data;
  assert.equal((await x.request(share)).data.trip.title, "New draft");
  const published = (await x.request(share)).data;
  assert.equal(published.revision, undefined);
  assert.equal(published.shareToken, undefined);
  record = (
    await x.request(path + "/rotate-link", "POST", {
      revision: record.revision,
    })
  ).data;
  assert.equal((await x.request(share)).status, 404);
  assert.equal((await x.request("share/" + record.shareToken)).status, 200);
  record = (
    await x.request(path + "/unpublish", "POST", { revision: record.revision })
  ).data;
  assert.equal((await x.request("share/" + record.shareToken)).status, 404);
  assert.equal(
    (await x.request(path, "DELETE", { revision: record.revision })).status,
    200,
  );
  assert.equal((await x.request(path)).status, 404);
  x.close();
});
test("incomplete/unverified flight cannot publish but can save draft", async () => {
  const x = setup();
  await x.request("login", "POST", { passcode: "test-private-passcode" });
  const trip = fixture();
  trip.options[0].journeys[0].segments[0].verified = false;
  const r = await x.request("trips", "POST", trip);
  assert.equal(r.status, 201);
  const p = await x.request("trips/" + r.data.id + "/publish", "POST", {
    revision: r.data.revision,
  });
  assert.equal(p.status, 422);
  assert.ok(p.data.issues.length);
  x.close();
});
test("secret rotation invalidates old sessions; API keys are never sent to client", async () => {
  const x = setup();
  await x.request("login", "POST", { passcode: "test-private-passcode" });
  assert.equal((await x.request("session")).data.aeroConfigured, false);
  assert.equal(
    (await x.request("lookup", "POST", { flight: "LH413", date: "2027-01-01" }))
      .status,
    422,
  );
  x.env.ADMIN_PASSCODE = "another-private-passcode";
  assert.equal((await x.request("trips")).status, 401);
  x.close();
});
test("login attempts are capped and invalid amounts are rejected", async () => {
  const x = setup();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await x.request("login", "POST", { passcode: "bad" })).status,
      401,
    );
  assert.equal(
    (await x.request("login", "POST", { passcode: "test-private-passcode" }))
      .status,
    429,
  );
  x.close();
  const y = setup();
  await y.request("login", "POST", { passcode: "test-private-passcode" });
  const f = fixture();
  f.options[0].prices[0].cash = -10;
  assert.equal((await y.request("trips", "POST", f)).status, 400);
  y.close();
});
