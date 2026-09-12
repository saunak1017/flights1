import {
  CABINS,
  ALLIANCES,
  CURRENCIES,
  validDate,
  optionIssues,
} from "../public/core.js";
const text = (v, n = 160) => (typeof v === "string" ? v.slice(0, n) : "");
const list = (v, n) => {
  if (!Array.isArray(v) || v.length > n)
    throw Error(`Invalid list (maximum ${n} entries).`);
  return v;
};
const choose = (v, a, f = "") => (a.includes(v) ? v : f);
const number = (v, max = 1e9) => {
  if (v === "" || v === undefined || v === null) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max)
    throw Error("Amounts must be valid non-negative numbers.");
  return n;
};
const bags = (v) => {
  const n = number(v, 20);
  if (n !== "" && !Number.isInteger(n))
    throw Error("Bag counts must be whole numbers.");
  return n;
};
const id = (v) => text(v, 80) || crypto.randomUUID();
function defaults(v) {
  return {
    cabin: choose(v.cabin, CABINS),
    carryOn: bags(v.carryOn),
    checked: bags(v.checked),
    bagWeight: text(v.bagWeight, 100),
    alliance: choose(v.alliance, ALLIANCES),
  };
}
export function cleanTrip(v) {
  if (!v || typeof v !== "object") throw Error("Invalid trip.");
  const out = {
    title: text(v.title),
    origin: text(v.origin, 100),
    destination: text(v.destination, 100),
    type: choose(v.type, ["oneway", "roundtrip"], "roundtrip"),
    travelers: list(v.travelers, 100)
      .map((x) => text(x, 120))
      .filter(Boolean),
    notes: text(v.notes, 5000),
    dateSets: list(v.dateSets, 30).map((d) => ({
      departure: text(d.departure, 10),
      return: text(d.return, 10),
    })),
    options: list(v.options, 100).map((o) => ({
      id: id(o.id),
      title: text(o.title),
      type: choose(o.type, ["oneway", "roundtrip", "multicity"], "roundtrip"),
      recommended: o.recommended === true,
      notes: text(o.notes, 5000),
      ...defaults(o),
      prices: list(o.prices, 100).map((p) => ({
        id: id(p.id),
        label: text(p.label, 120),
        currency: choose(p.currency, CURRENCIES, "USD"),
        cash: number(p.cash),
        fees: number(p.fees),
        miles: number(p.miles),
        program: text(p.program, 120),
      })),
      journeys: list(o.journeys, 20).map((j) => ({
        id: id(j.id),
        label: text(j.label, 100),
        segments: list(j.segments, 20).map((s) => {
          const z = {
            id: id(s.id),
            ...defaults(s),
            verified: s.verified === true,
          };
          for (const k of [
            "flight",
            "iata",
            "airline",
            "operatedBy",
            "origin",
            "destination",
            "depDate",
            "depTime",
            "depZone",
            "arrDate",
            "arrTime",
            "arrZone",
            "depUTC",
            "arrUTC",
            "depOffset",
            "arrOffset",
            "aircraft",
            "source",
            "fetchedAt",
          ])
            z[k] = text(s[k]);
          z.origin = z.origin.toUpperCase().trim();
          z.destination = z.destination.toUpperCase().trim();
          z.iata = z.iata.toUpperCase().trim();
          return z;
        }),
      })),
    })),
  };
  if (!out.origin.trim() || !out.destination.trim())
    throw Error("Enter the departure and arrival cities.");
  if (!out.travelers.length) throw Error("Enter at least one traveler.");
  if (!out.dateSets.length) throw Error("Add a primary date combination.");
  for (const d of out.dateSets) {
    if (!validDate(d.departure))
      throw Error("Enter a valid departure date for each date combination.");
    if (
      out.type === "roundtrip" &&
      (!validDate(d.return) || d.return < d.departure)
    )
      throw Error("Return date must be on or after departure.");
  }
  return out;
}
export function publicationIssues(trip) {
  if (!trip.options.length) return ["Add at least one itinerary option."];
  return trip.options
    .flatMap((o, i) => optionIssues(o).map((m) => `Option ${i + 1}: ${m}`))
    .slice(0, 100);
}
