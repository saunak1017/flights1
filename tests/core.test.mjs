import test from "node:test";
import assert from "node:assert/strict";
import {
  dateLabel,
  addDays,
  dayDiff,
  validDate,
  localParts,
  localToUTC,
  segmentUTC,
  flightIdent,
  priceTotals,
  priceLabel,
  copyJourney,
  copyOption,
  optionIssues,
} from "../public/core.js";
import { normalizeFlight, schedulePath } from "../server/aero.js";
const flight = {
  id: "a",
  flight: "LH413",
  origin: "EWR",
  destination: "MUC",
  depDate: "2026-12-11",
  depTime: "20:50",
  depZone: "America/New_York",
  arrDate: "2026-12-12",
  arrTime: "10:30",
  arrZone: "Europe/Berlin",
  verified: true,
};
test("calendar dates stay identical in widely separated viewer timezones", () => {
  for (const tz of [
    "America/Los_Angeles",
    "Pacific/Honolulu",
    "Asia/Kolkata",
    "Pacific/Auckland",
  ]) {
    process.env.TZ = tz;
    assert.equal(dateLabel("2026-12-11"), "11 Dec 2026");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  }
  delete process.env.TZ;
});
test("calendar parsing rejects impossible dates", () => {
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(dayDiff("2026-12-31", "2027-01-01"), 1);
});
test("each airport gets its own local date, time and DST offset", () => {
  assert.deepEqual(localParts("2026-12-12T01:50:00Z", "America/New_York"), {
    date: "2026-12-11",
    time: "20:50",
  });
  assert.equal(
    localToUTC("2026-07-10", "20:50", "America/New_York"),
    "2026-07-11T00:50:00.000Z",
  );
  assert.equal(
    localToUTC("2026-12-11", "20:50", "America/New_York"),
    "2026-12-12T01:50:00.000Z",
  );
  assert.equal(
    localToUTC("2026-12-12", "12:00", "Asia/Kolkata"),
    "2026-12-12T06:30:00.000Z",
  );
});
test("DST gaps are rejected and repeated times require disambiguation", () => {
  assert.throws(
    () => localToUTC("2026-03-08", "02:30", "America/New_York"),
    /does not exist/,
  );
  assert.throws(
    () => localToUTC("2026-11-01", "01:30", "America/New_York"),
    /occurs twice/,
  );
  assert.equal(
    localToUTC(
      "2026-11-01",
      "01:30",
      "America/New_York",
      "2026-11-01T05:30:00Z",
    ),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    segmentUTC(
      {
        ...flight,
        depDate: "2026-11-01",
        depTime: "01:30",
        depOffset: "-05:00",
      },
      "dep",
    ),
    "2026-11-01T06:30:00.000Z",
  );
});
test("airline normalization handles two/three letter and numeric IATA codes", () => {
  for (const s of ["LH413", "lh 413", "DLH413"])
    assert.equal(flightIdent(s).icao, "DLH");
  assert.equal(flightIdent("VS9").icao, "VIR");
  assert.equal(flightIdent("AI119").icao, "AIC");
  assert.equal(flightIdent("6E17").icao, "IGO");
  assert.throws(() => flightIdent("1234"));
});
test("mixed pricing uses integer cents and keeps currencies/programs separate", () => {
  const p = [
    { cash: 620, currency: "USD" },
    { miles: 60000, program: "Aeroplan", fees: 85, currency: "USD" },
    { miles: 40000, program: "Flying Blue", fees: 12.35, currency: "EUR" },
    { cash: 100, currency: "INR" },
  ];
  assert.deepEqual(priceTotals(p, 2), {
    cash: { USD: 141000, EUR: 2470, INR: 20000 },
    miles: { Aeroplan: 120000, "Flying Blue": 80000 },
  });
  assert.match(priceLabel(p), /60,000 Aeroplan/);
  assert.equal(
    priceTotals([{ cash: 0.1, fees: 0.2, currency: "USD" }]).cash.USD,
    30,
  );
});
test("arbitrary mileage program names are safe object keys", () => {
  const r = priceTotals([
    { program: "__proto__", miles: 100 },
    { program: "constructor", miles: 200 },
  ]);
  assert.equal(r.miles.__proto__, 100);
  assert.equal(r.miles.constructor, 200);
});
test("copying a journey shifts overnight dates and clears verification and stale UTC", () => {
  const j = {
    id: "j",
    label: "Outbound",
    segments: [
      { ...flight, depUTC: "old", depOffset: "-05:00" },
      {
        ...flight,
        id: "b",
        origin: "MUC",
        destination: "BOM",
        depDate: "2026-12-12",
        arrDate: "2026-12-13",
      },
    ],
  };
  const c = copyJourney(j, "2027-01-01");
  assert.equal(c.segments[0].depDate, "2027-01-01");
  assert.equal(c.segments[1].arrDate, "2027-01-03");
  assert.equal(c.segments[0].verified, false);
  assert.equal(c.segments[0].depUTC, undefined);
  assert.equal(c.segments[0].depOffset, undefined);
  assert.equal(j.segments[0].depDate, "2026-12-11");
  assert.notEqual(c.segments[0].id, j.segments[0].id);
});
test("roundtrip copy allows separate outbound and return dates", () => {
  const c = copyOption(
    {
      id: "o",
      title: "Test",
      prices: [{ id: "p", cash: 1 }],
      journeys: [
        { id: "j", segments: [flight] },
        { id: "k", segments: [flight] },
      ],
    },
    ["2027-02-05", "2027-03-02"],
  );
  assert.equal(c.journeys[0].segments[0].depDate, "2027-02-05");
  assert.equal(c.journeys[1].segments[0].depDate, "2027-03-02");
});
test("publish validation catches backwards travel and unverified copies", () => {
  const o = {
    type: "oneway",
    journeys: [{ label: "Outbound", segments: [flight] }],
  };
  assert.deepEqual(optionIssues(o), []);
  assert.ok(
    optionIssues({
      ...o,
      journeys: [
        { label: "Outbound", segments: [{ ...flight, verified: false }] },
      ],
    }).some((s) => s.includes("confirm")),
  );
  assert.ok(
    optionIssues({
      ...o,
      journeys: [
        { label: "Outbound", segments: [{ ...flight, arrDate: "2026-12-10" }] },
      ],
    }).some((s) => s.includes("after departure")),
  );
});
test("future query uses schedules with a padded window and canonical code", () => {
  const u = new URL(
    schedulePath(flightIdent("LH413"), "2027-06-01", "", "2026-09-12"),
    "https://test",
  );
  assert.equal(u.pathname, "/schedules/2027-05-31/2027-06-03");
  assert.equal(u.searchParams.get("airline"), "DLH");
  assert.equal(u.searchParams.get("flight_number"), "413");
  assert.equal(u.searchParams.get("max_pages"), "1");
});
test("lookup filters on local departure date, never shifts input date to fit", async () => {
  const resolve = async (raw) => ({ code: raw.code_iata, zone: raw.timezone });
  const raw = {
    origin: { code_iata: "EWR", timezone: "America/New_York" },
    destination: { code_iata: "MUC", timezone: "Europe/Berlin" },
    scheduled_out: "2026-12-12T01:50:00Z",
    scheduled_in: "2026-12-12T09:30:00Z",
    aircraft_type: "A359",
  };
  const f = await normalizeFlight(
    raw,
    flightIdent("LH413"),
    "2026-12-11",
    resolve,
  );
  assert.equal(f.depDate, "2026-12-11");
  assert.equal(f.arrDate, "2026-12-12");
  assert.equal(f.depTime, "20:50");
  assert.equal(f.arrTime, "10:30");
  assert.equal(
    await normalizeFlight(raw, flightIdent("LH413"), "2026-12-12", resolve),
    null,
  );
});
