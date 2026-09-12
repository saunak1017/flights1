// Shared by browser and server. Calendar dates are strings, never viewer-local Dates.
export const MAX_ITERATIONS = 100000;
export const CABINS = ["Economy", "Premium economy", "Business", "First"];
export const ALLIANCES = ["", "Star Alliance", "oneworld", "SkyTeam", "None"];
export const CURRENCIES = ["USD", "INR", "EUR"];
export const AIRLINES = [
  ["LH", "DLH", "Lufthansa", "Star Alliance"],
  ["VS", "VIR", "Virgin Atlantic", "SkyTeam"],
  ["AI", "AIC", "Air India", "Star Alliance"],
  ["UA", "UAL", "United Airlines", "Star Alliance"],
  ["DL", "DAL", "Delta Air Lines", "SkyTeam"],
  ["AA", "AAL", "American Airlines", "oneworld"],
  ["BA", "BAW", "British Airways", "oneworld"],
  ["AF", "AFR", "Air France", "SkyTeam"],
  ["KL", "KLM", "KLM", "SkyTeam"],
  ["EK", "UAE", "Emirates", "None"],
  ["EY", "ETD", "Etihad Airways", "None"],
  ["QR", "QTR", "Qatar Airways", "oneworld"],
  ["SQ", "SIA", "Singapore Airlines", "Star Alliance"],
  ["CX", "CPA", "Cathay Pacific", "oneworld"],
  ["LX", "SWR", "SWISS", "Star Alliance"],
  ["OS", "AUA", "Austrian Airlines", "Star Alliance"],
  ["SN", "BEL", "Brussels Airlines", "Star Alliance"],
  ["AC", "ACA", "Air Canada", "Star Alliance"],
  ["TK", "THY", "Turkish Airlines", "Star Alliance"],
  ["NH", "ANA", "ANA", "Star Alliance"],
  ["JL", "JAL", "Japan Airlines", "oneworld"],
  ["QF", "QFA", "Qantas", "oneworld"],
  ["AY", "FIN", "Finnair", "oneworld"],
  ["IB", "IBE", "Iberia", "oneworld"],
  ["AS", "ASA", "Alaska Airlines", "oneworld"],
  ["B6", "JBU", "JetBlue", "None"],
  ["WN", "SWA", "Southwest", "None"],
  ["6E", "IGO", "IndiGo", "None"],
  ["SG", "SEJ", "SpiceJet", "None"],
  ["IX", "AXB", "Air India Express", "None"],
  ["NZ", "ANZ", "Air New Zealand", "Star Alliance"],
  ["BR", "EVA", "EVA Air", "Star Alliance"],
  ["CI", "CAL", "China Airlines", "SkyTeam"],
  ["KE", "KAL", "Korean Air", "SkyTeam"],
  ["ET", "ETH", "Ethiopian Airlines", "Star Alliance"],
  ["LO", "LOT", "LOT Polish Airlines", "Star Alliance"],
  ["TP", "TAP", "TAP Air Portugal", "Star Alliance"],
  ["SK", "SAS", "SAS", "SkyTeam"],
  ["SV", "SVA", "Saudia", "SkyTeam"],
  ["GA", "GIA", "Garuda Indonesia", "SkyTeam"],
];
// Frequently used airports. Other airport timezones are obtained from AeroAPI or entered manually.
export const AIRPORTS = {
  JFK: ["New York JFK", "America/New_York"],
  EWR: ["Newark", "America/New_York"],
  LGA: ["New York LaGuardia", "America/New_York"],
  BOS: ["Boston", "America/New_York"],
  IAD: ["Washington Dulles", "America/New_York"],
  DCA: ["Washington Reagan", "America/New_York"],
  ATL: ["Atlanta", "America/New_York"],
  MIA: ["Miami", "America/New_York"],
  MCO: ["Orlando", "America/New_York"],
  PHL: ["Philadelphia", "America/New_York"],
  ORD: ["Chicago", "America/Chicago"],
  DFW: ["Dallas Fort Worth", "America/Chicago"],
  IAH: ["Houston", "America/Chicago"],
  DEN: ["Denver", "America/Denver"],
  PHX: ["Phoenix", "America/Phoenix"],
  LAX: ["Los Angeles", "America/Los_Angeles"],
  SFO: ["San Francisco", "America/Los_Angeles"],
  SEA: ["Seattle", "America/Los_Angeles"],
  LAS: ["Las Vegas", "America/Los_Angeles"],
  YYZ: ["Toronto", "America/Toronto"],
  YVR: ["Vancouver", "America/Vancouver"],
  YUL: ["Montreal", "America/Toronto"],
  LHR: ["London Heathrow", "Europe/London"],
  LGW: ["London Gatwick", "Europe/London"],
  MAN: ["Manchester", "Europe/London"],
  FRA: ["Frankfurt", "Europe/Berlin"],
  MUC: ["Munich", "Europe/Berlin"],
  BRU: ["Brussels", "Europe/Brussels"],
  AMS: ["Amsterdam", "Europe/Amsterdam"],
  CDG: ["Paris CDG", "Europe/Paris"],
  ORY: ["Paris Orly", "Europe/Paris"],
  ZRH: ["Zurich", "Europe/Zurich"],
  VIE: ["Vienna", "Europe/Vienna"],
  MAD: ["Madrid", "Europe/Madrid"],
  BCN: ["Barcelona", "Europe/Madrid"],
  FCO: ["Rome", "Europe/Rome"],
  MXP: ["Milan", "Europe/Rome"],
  LIS: ["Lisbon", "Europe/Lisbon"],
  HEL: ["Helsinki", "Europe/Helsinki"],
  CPH: ["Copenhagen", "Europe/Copenhagen"],
  IST: ["Istanbul", "Europe/Istanbul"],
  BOM: ["Mumbai / Bombay", "Asia/Kolkata"],
  DEL: ["Delhi", "Asia/Kolkata"],
  BLR: ["Bengaluru", "Asia/Kolkata"],
  HYD: ["Hyderabad", "Asia/Kolkata"],
  MAA: ["Chennai", "Asia/Kolkata"],
  AMD: ["Ahmedabad", "Asia/Kolkata"],
  CCU: ["Kolkata", "Asia/Kolkata"],
  GOI: ["Goa", "Asia/Kolkata"],
  GOX: ["Goa Manohar", "Asia/Kolkata"],
  DXB: ["Dubai", "Asia/Dubai"],
  AUH: ["Abu Dhabi", "Asia/Dubai"],
  DOH: ["Doha", "Asia/Qatar"],
  RUH: ["Riyadh", "Asia/Riyadh"],
  JED: ["Jeddah", "Asia/Riyadh"],
  SIN: ["Singapore", "Asia/Singapore"],
  HKG: ["Hong Kong", "Asia/Hong_Kong"],
  BKK: ["Bangkok", "Asia/Bangkok"],
  KUL: ["Kuala Lumpur", "Asia/Kuala_Lumpur"],
  DPS: ["Bali", "Asia/Makassar"],
  CGK: ["Jakarta", "Asia/Jakarta"],
  NRT: ["Tokyo Narita", "Asia/Tokyo"],
  HND: ["Tokyo Haneda", "Asia/Tokyo"],
  ICN: ["Seoul Incheon", "Asia/Seoul"],
  TPE: ["Taipei", "Asia/Taipei"],
  PVG: ["Shanghai", "Asia/Shanghai"],
  PEK: ["Beijing", "Asia/Shanghai"],
  SYD: ["Sydney", "Australia/Sydney"],
  MEL: ["Melbourne", "Australia/Melbourne"],
  AKL: ["Auckland", "Pacific/Auckland"],
  HNL: ["Honolulu", "Pacific/Honolulu"],
  JNB: ["Johannesburg", "Africa/Johannesburg"],
  ADD: ["Addis Ababa", "Africa/Addis_Ababa"],
  NBO: ["Nairobi", "Africa/Nairobi"],
};
export const uid = () => crypto.randomUUID();
export const clone = (x) => structuredClone(x);
export function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const n = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s;
}
export function addDays(s, n) {
  if (!validDate(s) || !Number.isInteger(n) || Math.abs(n) > MAX_ITERATIONS)
    throw Error("Invalid calendar date or day shift.");
  return new Date(Date.parse(s + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dayDiff(a, b) {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000,
  );
}
export function dateLabel(s) {
  if (!validDate(s)) return s || "Date not set";
  const [y, m, d] = s.split("-");
  return `${Number(d)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}
export function zoneValid(z) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: z }).format();
    return !!z;
  } catch {
    return false;
  }
}
export function localParts(iso, zone) {
  if (!zoneValid(zone) || !Number.isFinite(Date.parse(iso)))
    throw Error("A valid timestamp and airport timezone are required.");
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
// Enumerate plausible offsets near the date, then round-trip. Reject nonexistent and ambiguous DST times.
export function localToUTC(date, time, zone, preferred = "") {
  if (
    !validDate(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "") ||
    !zoneValid(zone)
  )
    throw Error("Enter a valid date, time, and airport timezone.");
  const target = Date.parse(`${date}T${time}:00Z`),
    offsets = new Set();
  for (const h of [-36, -12, 0, 12, 36]) {
    const probe = target + h * 3600000,
      p = localParts(new Date(probe).toISOString(), zone);
    offsets.add(Date.parse(`${p.date}T${p.time}:00Z`) - probe);
  }
  const matches = [...offsets]
    .map((o) => new Date(target - o).toISOString())
    .filter((iso) => {
      const p = localParts(iso, zone);
      return p.date === date && p.time === time;
    });
  if (matches.length === 1) return matches[0];
  if (preferred && matches.includes(new Date(preferred).toISOString()))
    return new Date(preferred).toISOString();
  if (!matches.length)
    throw Error(
      "This local time does not exist because of daylight saving. Check the schedule.",
    );
  throw Error(
    "This local time occurs twice during daylight saving. Enter its UTC offset (for example -04:00 or -05:00).",
  );
}
export function segmentUTC(s, side) {
  const date = s[side + "Date"],
    time = s[side + "Time"],
    zone = s[side + "Zone"];
  let preferred = s[side + "UTC"] || "";
  const offset = s[side + "Offset"];
  if (offset) {
    if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset))
      throw Error("UTC offset must look like +05:30 or -04:00.");
    preferred = new Date(`${date}T${time}:00${offset}`).toISOString();
    const p = localParts(preferred, zone);
    if (p.date !== date || p.time !== time)
      throw Error(
        "UTC offset does not match this airport’s timezone on this date.",
      );
  }
  return localToUTC(date, time, zone, preferred);
}
export function duration(s) {
  try {
    return (
      (Date.parse(segmentUTC(s, "arr")) - Date.parse(segmentUTC(s, "dep"))) /
      60000
    );
  } catch {
    return null;
  }
}
export function journeyMinutes(j) {
  try {
    if (!j.segments.length) return null;
    return (
      (Date.parse(segmentUTC(j.segments.at(-1), "arr")) -
        Date.parse(segmentUTC(j.segments[0], "dep"))) /
      60000
    );
  } catch {
    return null;
  }
}
export function layover(a, b) {
  try {
    return {
      minutes:
        (Date.parse(segmentUTC(b, "dep")) - Date.parse(segmentUTC(a, "arr"))) /
        60000,
      airportChange: a.destination !== b.origin,
    };
  } catch {
    return { minutes: null, airportChange: a.destination !== b.origin };
  }
}
export function minutesLabel(n) {
  return n === null || !Number.isFinite(n)
    ? "Duration pending"
    : `${n < 0 ? "−" : ""}${Math.floor(Math.abs(n) / 60)}h ${Math.abs(n) % 60}m`;
}
export function flightIdent(raw) {
  const s = String(raw || "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
  let match =
    s.match(/^([A-Z]{3})(\d{1,4}[A-Z]?)$/) ||
    s.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (!match || !/[A-Z]/.test(match[1]))
    throw Error(
      "Enter an airline flight number, such as LH413, VS9, AI119, or 6E17.",
    );
  const row = AIRLINES.find((a) => a[0] === match[1] || a[1] === match[1]);
  return {
    iata: row?.[0] || (match[1].length === 2 ? match[1] : ""),
    icao: row?.[1] || (match[1].length === 3 ? match[1] : ""),
    number: match[2],
    airline: row?.[2] || match[1],
    alliance: row?.[3] || "",
    display: (row?.[0] || match[1]) + match[2],
  };
}
export function priceTotals(prices, travelers = 1) {
  const cash = {},
    miles = {};
  for (const p of prices.slice(0, 100)) {
    const currency = p.currency || "USD",
      program = p.program?.trim() || "Miles";
    const amount =
      Math.round(Number(p.cash || 0) * 100) +
      Math.round(Number(p.fees || 0) * 100);
    if (amount) cash[currency] = (cash[currency] || 0) + amount * travelers;
    if (Number(p.miles))
      Object.defineProperty(miles, program, {
        value:
          (Object.hasOwn(miles, program) ? miles[program] : 0) +
          Number(p.miles) * travelers,
        writable: true,
        enumerable: true,
        configurable: true,
      });
  }
  return { cash, miles };
}
export function money(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
export function priceLabel(prices, count = 1) {
  const t = priceTotals(prices, count),
    parts = [
      ...Object.entries(t.miles).map(
        ([p, n]) => `${n.toLocaleString("en-US")} ${p}`,
      ),
      ...Object.entries(t.cash).map(([c, n]) => money(n / 100, c)),
    ];
  return parts.join(" + ") || "Price not set";
}
export function newSegment(date = "") {
  return {
    id: uid(),
    flight: "",
    iata: "",
    airline: "",
    operatedBy: "",
    origin: "",
    destination: "",
    depDate: date,
    depTime: "",
    depZone: "",
    arrDate: date,
    arrTime: "",
    arrZone: "",
    aircraft: "",
    cabin: "",
    carryOn: "",
    checked: "",
    bagWeight: "",
    alliance: "",
    verified: false,
  };
}
export function newJourney(label, date = "") {
  return { id: uid(), label, segments: [newSegment(date)] };
}
export function newOption(type = "roundtrip", dates = {}) {
  return {
    id: uid(),
    title: "",
    type,
    recommended: false,
    notes: "",
    cabin: "Economy",
    carryOn: "",
    checked: "",
    bagWeight: "",
    alliance: "",
    prices: [
      {
        id: uid(),
        label: "Entire itinerary",
        cash: "",
        miles: "",
        program: "",
        fees: "",
        currency: "USD",
      },
    ],
    journeys:
      type === "roundtrip"
        ? [
            newJourney("Outbound", dates.departure),
            newJourney("Return", dates.return),
          ]
        : [
            newJourney(
              type === "multicity" ? "Journey 1" : "Outbound",
              dates.departure,
            ),
          ],
  };
}
export function copyJourney(j, newDate) {
  const result = clone(j);
  result.id = uid();
  const old = result.segments[0]?.depDate,
    shift = newDate && old ? dayDiff(old, newDate) : 0;
  if (newDate && !validDate(newDate))
    throw Error("Enter a valid departure date.");
  result.segments = result.segments.map((s) => {
    s.id = uid();
    if (shift) {
      s.depDate = addDays(s.depDate, shift);
      s.arrDate = addDays(s.arrDate, shift);
      delete s.depUTC;
      delete s.arrUTC;
      delete s.depOffset;
      delete s.arrOffset;
      s.verified = false;
      s.source = "Copied schedule — confirm times";
    }
    return s;
  });
  return result;
}
export function copyOption(o, dates = []) {
  const c = clone(o);
  c.id = uid();
  c.title = (c.title || "Option") + " (copy)";
  c.recommended = false;
  c.journeys = c.journeys.map((j, i) => copyJourney(j, dates[i]));
  c.prices = c.prices.map((p) => ({ ...p, id: uid() }));
  return c;
}
export function optionIssues(o) {
  const errors = [];
  if (!o.journeys.length) errors.push("Add at least one journey.");
  if (o.type === "roundtrip" && o.journeys.length !== 2)
    errors.push("A roundtrip needs outbound and return journeys.");
  if (o.type === "oneway" && o.journeys.length !== 1)
    errors.push("A one-way option needs one journey.");
  if (o.type === "multicity" && o.journeys.length < 2)
    errors.push("A multicity option needs at least two journeys.");
  for (const [ji, j] of o.journeys.entries()) {
    if (!j.segments.length) errors.push(`${j.label}: add a flight.`);
    for (const [i, s] of j.segments.entries()) {
      const name = `${j.label}, flight ${i + 1}`;
      if (!s.flight || !s.origin || !s.destination)
        errors.push(`${name}: enter flight number and airports.`);
      if (s.origin && s.origin === s.destination)
        errors.push(`${name}: departure and arrival airports must differ.`);
      try {
        const d =
          Date.parse(segmentUTC(s, "arr")) - Date.parse(segmentUTC(s, "dep"));
        if (d <= 0) errors.push(`${name}: arrival must be after departure.`);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
      if (!s.verified)
        errors.push(`${name}: confirm the schedule before publishing.`);
      if (i > 0 && layover(j.segments[i - 1], s).minutes < 0)
        errors.push(`${name}: flight overlaps the previous flight.`);
    }
    if (ji > 0) {
      const a = o.journeys[ji - 1].segments.at(-1),
        b = j.segments[0];
      if (a && b && layover(a, b).minutes < 0)
        errors.push(
          `${j.label}: journey starts before the previous journey ends.`,
        );
    }
  }
  return errors;
}
