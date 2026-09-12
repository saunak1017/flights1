import {
  AIRPORTS,
  AIRLINES,
  CABINS,
  ALLIANCES,
  CURRENCIES,
  uid,
  clone,
  validDate,
  dateLabel,
  dayDiff,
  flightIdent,
  newOption,
  newJourney,
  newSegment,
  copyJourney,
  copyOption,
  priceLabel,
  money,
  priceTotals,
  minutesLabel,
  duration,
  journeyMinutes,
  layover,
  optionIssues,
} from "./core.js";
const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog"),
  toastEl = document.querySelector("#toast");
const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let record = null,
  selected = 0,
  dirty = false,
  locked = false,
  listPage = 0,
  listData = null,
  publicData = null,
  sort = "original",
  dialogAction = null,
  lookupBusy = false;
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 4500);
}
const button = (text, action, cls = "", extra = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
function shell(content, customer = false) {
  app.innerHTML = `<header class="topbar"><div class="brand"><img src="/favicon.svg" alt="">Flight proposals</div><div class="topnav">${customer ? '<span class="muted">Your journey, thoughtfully planned</span>' : `${button("All trips", "home", "ghost small")}<span class="muted">Planning workspace</span>${button("Sign out", "logout", "ghost small")}`}</div></header><main class="workspace">${content}</main>`;
}
function modal(title, html, onSubmit = null, wide = false) {
  dialog.className = wide ? "wide" : "";
  dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${e(title)}</h2>${button("✕", "close-dialog", "ghost small", 'aria-label="Close dialog"')}</div><div class="dialog-body">${html}</div>`;
  dialogAction = onSubmit;
  if (!dialog.open) dialog.showModal();
}
function errorDialog(err) {
  modal(
    "A little attention needed",
    `<div class="notice error">${e(err.message)}</div>${err.issues?.length ? `<ul class="issues">${err.issues.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}<div class="dialog-footer">${button("Close", "close-dialog")}</div>`,
  );
}
async function api(path, method = "GET", data) {
  const r = await fetch("/api/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "same-origin",
  });
  let b;
  try {
    b = await r.json();
  } catch {
    throw Error(
      "The server did not return an API response. Check the Pages Functions deployment.",
    );
  }
  if (!r.ok) {
    const err = Error(b.error || "Request failed.");
    err.status = r.status;
    err.issues = b.issues;
    err.retryAfter = Number(r.headers.get("retry-after")) || b.retryAfter || 0;
    throw err;
  }
  return b;
}
function dirtyMark() {
  dirty = true;
  const el = document.querySelector("#save-state");
  if (el) el.textContent = "Unsaved draft changes";
}
function pathGet(path) {
  return path.split(".").reduce((x, k) => x?.[k], record.trip);
}
function pathSet(path, value) {
  const keys = path.split("."),
    last = keys.pop();
  let obj = record.trip;
  for (const k of keys) obj = obj[k];
  obj[last] = value;
  dirtyMark();
}
function field(label, path, type = "text", extra = "") {
  return `<label>${label}<input type="${type}" data-path="${path}" value="${e(pathGet(path))}" ${extra}></label>`;
}
function selectField(label, path, values, blank = "") {
  const value = pathGet(path);
  return `<label>${label}<select data-path="${path}">${blank ? `<option value="">${e(blank)}</option>` : ""}${values
    .filter((x) => x !== "")
    .map(
      (v) =>
        `<option value="${e(v)}" ${v === value ? "selected" : ""}>${e({ oneway: "One-way", roundtrip: "Roundtrip", multicity: "Multicity" }[v] || v)}</option>`,
    )
    .join("")}</select></label>`;
}
function textField(label, path) {
  return `<label>${label}<textarea data-path="${path}" maxlength="5000">${e(pathGet(path))}</textarea></label>`;
}
function check(label, path) {
  return `<label class="check"><input type="checkbox" data-path="${path}" ${pathGet(path) ? "checked" : ""}>${label}</label>`;
}
function airlineLogo(iata) {
  return /^[A-Z0-9]{2}$/.test(iata || "")
    ? `<img class="airline-logo" loading="lazy" referrerpolicy="no-referrer" src="https://www.gstatic.com/flights/airline_logos/70px/${iata}.png" alt="">`
    : "";
}
document.addEventListener(
  "error",
  (event) => {
    if (event.target.matches?.(".airline-logo"))
      event.target.classList.add("hidden");
  },
  true,
);
function bagsText(carry, checked) {
  const c =
    carry !== "" && carry !== undefined
      ? `🧳 × ${carry} carry-on`
      : "Carry-on not specified";
  const b =
    checked !== "" && checked !== undefined
      ? `🧳 × ${checked} checked`
      : "Checked bags not specified";
  return c + " · " + b;
}
function inherited(s, o, k) {
  return s[k] !== "" && s[k] !== undefined ? s[k] : o[k];
}
function optionMeta(o) {
  const ss = o.journeys.flatMap((j) => j.segments),
    vals = (k) => [
      ...new Set(
        ss
          .map((s) => inherited(s, o, k))
          .filter((v) => v !== "" && v !== undefined),
      ),
    ];
  const cabins = vals("cabin"),
    alliances = vals("alliance");
  let bagVar = ss.some(
    (s) =>
      String(inherited(s, o, "carryOn")) !== String(o.carryOn) ||
      String(inherited(s, o, "checked")) !== String(o.checked),
  );
  return `<span>${e(cabins.length > 1 ? "Mixed cabin" : cabins[0] || "Cabin not specified")}</span>${alliances.length ? `<span>· ${e(alliances.length > 1 ? "Mixed alliances" : alliances[0])}</span>` : ""}<span>· ${bagVar ? "Baggage varies by flight" : e(bagsText(o.carryOn, o.checked))}</span>`;
}
function dayBadge(s) {
  const d = dayDiff(s.depDate, s.arrDate);
  return Number.isFinite(d) && d
    ? `<sup>${d > 0 ? "+" : ""}${d} ${Math.abs(d) === 1 ? "day" : "days"}</sup>`
    : "";
}
function journeySummary(j) {
  const ss = j.segments,
    a = ss[0],
    b = ss.at(-1);
  if (!a) return `<p class="muted">${e(j.label)} — no flights yet</p>`;
  const names = [...new Set(ss.map((s) => s.airline || s.flight))];
  const n = dayDiff(a.depDate, b.arrDate);
  return `<div class="journey-summary"><div class="airline-cell">${airlineLogo(a.iata)}<span>${e(names.join(" / "))}<br><small class="muted">${e(j.label)}</small></span></div><div class="timing"><div class="time-point"><strong>${e(a.depTime || "—")}</strong><small>${e(a.origin || "From")} · ${e(dateLabel(a.depDate))}</small></div><div class="flight-line">${ss.length === 1 ? "Nonstop" : `${ss.length - 1} stop${ss.length > 2 ? "s" : ""}`}<div class="line"></div>${
    e(
      ss
        .slice(0, -1)
        .map((s) => s.destination)
        .join(" · "),
    ) || "Direct"
  }</div><div class="time-point end"><strong>${e(b.arrTime || "—")}${Number.isFinite(n) && n ? `<sup>${n > 0 ? "+" : ""}${n}</sup>` : ""}</strong><small>${e(b.destination || "To")} · ${e(dateLabel(b.arrDate))}</small></div></div><div class="journey-duration">${minutesLabel(journeyMinutes(j))}<small>${ss.length} flight${ss.length > 1 ? "s" : ""}</small></div></div>`;
}
function connectionText(a, b) {
  const l = layover(a, b);
  return `${l.airportChange ? "Airport transfer" : "Layover"} · ${minutesLabel(l.minutes)} · ${a.destination}${l.airportChange ? " → " + b.origin : ""}${l.minutes !== null && l.minutes < 0 ? " — overlapping flights" : ""}`;
}
function optionCard(o, index, count) {
  return `<details class="option-card"><summary><div class="card-top"><h3>OPTION ${String(index + 1).padStart(2, "0")} &nbsp; ${e(o.title || { oneway: "One-way", roundtrip: "Roundtrip", multicity: "Multicity" }[o.type])}</h3>${o.recommended ? '<span class="badge green">✦ Recommended</span>' : '<span class="badge">' + e({ oneway: "One-way", roundtrip: "Roundtrip", multicity: "Multicity" }[o.type]) + "</span>"}</div>${o.journeys.map(journeySummary).join("")}<div class="card-bottom"><div class="amenities">${optionMeta(o)}</div><div class="price-display"><strong>${e(priceLabel(o.prices))}</strong><small>per traveler${count > 1 ? ` · ${e(priceLabel(o.prices, count))} for ${count} travelers` : ""}</small></div></div><span class="expand-label">View full itinerary &nbsp;⌄</span></summary><div class="itinerary-detail">${o.journeys.map((j) => `<section class="detail-journey"><h3>${e(j.label)}</h3>${j.segments.map((s, i) => `${i ? `<div class="notice ${layover(j.segments[i - 1], s).airportChange ? "warn" : ""}">${e(connectionText(j.segments[i - 1], s))}${layover(j.segments[i - 1], s).airportChange ? "<br>Allow time for ground transport, baggage collection, and check-in." : ""}</div>` : ""}<div class="flight-detail"><div>${airlineLogo(s.iata)}</div><div><div class="flight-title">${e(s.airline || s.flight)} · ${e(s.flight)}${s.operatedBy ? ` <span class="muted">· Operated by ${e(s.operatedBy)}</span>` : ""}</div><div>${e(s.depTime || "—")} <strong>${e(s.origin)}</strong> <span class="muted">${e(dateLabel(s.depDate))}</span> → ${e(s.arrTime || "—")} <strong>${e(s.destination)}</strong> ${dayBadge(s)} <span class="muted">${e(dateLabel(s.arrDate))}</span></div><p class="note">${e(AIRPORTS[s.origin]?.[0] || s.origin)} → ${e(AIRPORTS[s.destination]?.[0] || s.destination)} · ${minutesLabel(duration(s))}</p><div class="amenities"><span>${e(inherited(s, o, "cabin") || "Cabin not specified")}</span><span>· ${e(s.aircraft || "Aircraft not specified")}</span>${inherited(s, o, "alliance") ? `<span>· ${e(inherited(s, o, "alliance"))}</span>` : ""}</div><p class="note">${e(bagsText(inherited(s, o, "carryOn"), inherited(s, o, "checked")))}${inherited(s, o, "bagWeight") ? " · " + e(inherited(s, o, "bagWeight")) : ""}</p><div class="note">Local airport times · ${e(s.depZone)} → ${e(s.arrZone)}</div></div></div>`).join("")}</section>`).join("")}<section class="breakdown"><h3>Price breakdown <span class="muted">· per traveler</span></h3><table><tbody>${o.prices.map((p) => `<tr><td>${e(p.label || "Itinerary")} ${p.fees ? `<div class="note">Includes ${e(money(Number(p.fees), p.currency))} taxes & fees</div>` : ""}</td><td>${e(priceLabel([p]))}</td></tr>`).join("")}<tr><td><strong>Total per traveler</strong></td><td><strong>${e(priceLabel(o.prices))}</strong></td></tr>${count > 1 ? `<tr><td>Total for ${count} travelers</td><td>${e(priceLabel(o.prices, count))}</td></tr>` : ""}</tbody></table></section>${o.notes ? `<p class="proposal-note">${e(o.notes)}</p>` : ""}<p class="footnote">Prices are proposed amounts, subject to availability until booked. Connections shown are elapsed times, not a guarantee of minimum connection compliance.</p></div></details>`;
}
function proposalHTML(trip, publishedAt, preview = false) {
  let options = trip.options.map((o, i) => ({ o, i }));
  if (sort === "recommended")
    options.sort((a, b) => Number(b.o.recommended) - Number(a.o.recommended));
  if (sort === "duration")
    options.sort(
      (a, b) =>
        a.o.journeys.reduce((n, j) => n + (journeyMinutes(j) ?? 1e6), 0) -
        b.o.journeys.reduce((n, j) => n + (journeyMinutes(j) ?? 1e6), 0),
    );
  return `<div class="proposal">${preview ? '<div class="notice warn">Draft preview — customers only see the version you publish.</div>' : ""}<div class="proposal-head"><div class="eyebrow">A journey for ${e(trip.travelers.join(" & "))}</div><h1>${e(trip.origin)} <span class="muted">→</span> ${e(trip.destination)}</h1>${trip.title ? `<p>${e(trip.title)}</p>` : ""}<div class="proposal-meta">${trip.dateSets.map((d, i) => `<span class="badge">${i ? "Alternative " + i : "Primary dates"} · ${e(dateLabel(d.departure))}${trip.type === "roundtrip" ? " – " + e(dateLabel(d.return)) : ""}</span>`).join("")}</div><p class="note">All departure and arrival times are local to each airport.${publishedAt ? " Updated " + e(dateLabel(publishedAt.slice(0, 10))) + "." : ""}</p></div>${trip.notes ? `<div class="proposal-note">${e(trip.notes)}</div>` : ""}<div class="results-head"><h2>${trip.options.length} flight option${trip.options.length === 1 ? "" : "s"}</h2><label>Order by<select id="sort"><option value="original" ${sort === "original" ? "selected" : ""}>Planner’s order</option><option value="recommended" ${sort === "recommended" ? "selected" : ""}>Recommended first</option><option value="duration" ${sort === "duration" ? "selected" : ""}>Total travel time</option></select></label></div>${options.map(({ o, i }) => optionCard(o, i, trip.travelers.length)).join("") || '<div class="empty">No options added yet.</div>'}<p class="footnote">Compare each option’s travel dates, cabin and baggage before choosing. Different currencies and mileage programs are shown separately.</p></div>`;
}
function login(message = "") {
  record = null;
  shell(
    `<section class="panel login"><div class="eyebrow">Planning workspace</div><h1>Welcome back.</h1><p>Sign in to put the next journey together.</p>${message ? `<div class="notice error">${e(message)}</div><br>` : ""}<form id="login-form"><label>Admin passcode<input name="passcode" type="password" required autocomplete="current-password" autofocus></label><button class="primary" type="submit">Open workspace →</button></form></section>`,
  );
}
async function showHome(page = 0) {
  if (dirty && !confirm("Leave this trip without saving your draft changes?"))
    return;
  dirty = false;
  record = null;
  listPage = page;
  history.replaceState(null, "", "/");
  listData = await api("trips?page=" + page);
  renderHome();
}
function renderHome(query = "") {
  const all = listData?.trips || [],
    rows = all.filter((t) =>
      (t.title + " " + t.origin + " " + t.destination + " " + t.travelers)
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  shell(
    `<div class="intro"><div><div class="eyebrow">Your planning desk</div><h1>Good trips start here.</h1><p class="muted">Bring the options together. Give every traveler a clear way forward.</p></div>${button("+ Create trip", "create-trip", "primary")}</div><div class="panel-head"><h2>Your trips <span class="muted">${all.length}${listData.more ? "+" : ""}</span></h2><input class="search-input" id="trip-search" aria-label="Find trips on this page" placeholder="Find a trip on this page…" value="${e(query)}"></div><div class="trips">${rows
      .map((t) => {
        const ds = JSON.parse(t.dateSets || "[]");
        return `<article class="trip-card"><div class="actions"><span class="badge ${t.published_at ? "green" : ""}">${t.published_at ? "Published" : "Draft"}</span><span class="note">${t.optionCount} option${t.optionCount === 1 ? "" : "s"}</span></div><div class="route-mini">${e(t.origin)} → ${e(t.destination)}</div><h2>${e(t.title || t.origin + " to " + t.destination)}</h2><div class="meta">${e(JSON.parse(t.travelers || "[]").join(", "))}<br>${e(dateLabel(ds[0]?.departure))}${ds[0]?.return ? " – " + e(dateLabel(ds[0].return)) : ""}${ds.length > 1 ? `<br>+ ${ds.length - 1} alternative date combination${ds.length > 2 ? "s" : ""}` : ""}</div>${button("Open trip &nbsp; →", "open-trip", "", 'data-id="' + e(t.id) + '"')}</article>`;
      })
      .join(
        "",
      )}</div>${!rows.length ? `<div class="empty"><div class="plane">✈</div><h2>${query ? "No matching trips" : "Your next journey starts with a trip"}</h2><p>${query ? "Try another traveler or destination." : "Add travelers and dates, then build a few great flight options."}</p>${query ? "" : button("Create your first trip", "create-trip", "primary")}</div>` : ""}<div class="list-footer">${listPage ? button("← Previous", "prev-page") : ""}${listData.more ? button("Next trips →", "next-page") : ""}</div>`,
  );
}
function createTrip() {
  modal(
    "Create a trip",
    `<form id="modal-form"><div class="grid"><label>Departure city<input name="origin" placeholder="New York" required maxlength="100"></label><label>Arrival city<input name="destination" placeholder="Mumbai / Bombay" required maxlength="100"></label><label>Trip title <span class="muted">optional</span><input name="title" placeholder="Winter visit" maxlength="160"></label><label>Trip type<select name="type" id="create-type"><option value="roundtrip">Roundtrip</option><option value="oneway">One-way</option></select></label><label>Departure date<input name="departure" type="date" required></label><label id="create-return">Return date<input name="return" type="date" required></label><label class="full">Travelers <span class="muted">one name per line</span><textarea name="travelers" maxlength="12000" placeholder="Saunak Shah" required></textarea></label></div><p class="note">You can add more date combinations and notes after creating the trip.</p><div class="dialog-footer">${button("Cancel", "close-dialog")}<button class="primary" type="submit">Create trip →</button></div></form>`,
    async (f) => {
      const v = Object.fromEntries(f);
      const trip = {
        title: v.title,
        origin: v.origin,
        destination: v.destination,
        type: v.type,
        travelers: v.travelers
          .split("\n", 101)
          .map((s) => s.trim())
          .filter(Boolean),
        dateSets: [
          {
            departure: v.departure,
            return: v.type === "roundtrip" ? v.return : "",
          },
        ],
        notes: "",
        options: [],
      };
      record = await api("trips", "POST", trip);
      selected = 0;
      dirty = false;
      dialog.close();
      history.replaceState(null, "", "/?trip=" + record.id);
      renderEditor();
    },
  );
}
async function openTrip(id) {
  record = await api("trips/" + encodeURIComponent(id));
  dirty = false;
  selected = 0;
  history.replaceState(null, "", "/?trip=" + record.id);
  renderEditor();
}
function tripDetails() {
  return `<details class="panel trip-details"><summary>Trip details & dates <span class="muted">· ${e(record.trip.travelers.join(", "))}</span></summary><div class="inside"><div class="grid">${field("Trip title", "title")}${selectField("Trip type", "type", ["roundtrip", "oneway"])}${field("Departure city", "origin")}${field("Arrival city", "destination")}<label class="full">Travelers — one per line<textarea id="travelers" maxlength="12000">${e(record.trip.travelers.join("\n"))}</textarea></label></div><h3>Travel dates</h3>${record.trip.dateSets.map((d, i) => `<div class="date-row"><span class="date-name">${i ? "Alternative " + i : "Primary dates"}</span>${field("Departure", `dateSets.${i}.departure`, "date")}${record.trip.type === "roundtrip" ? field("Return", `dateSets.${i}.return`, "date") : "<span></span>"}${i ? button("Remove", "remove-dates", "ghost small", `data-i="${i}"`) : "<span></span>"}</div>`).join("")}<p>${button("+ Add date combination", "add-dates", "small")}</p>${textField("Trip notes shown to travelers", "notes")}</div></details>`;
}
function renderEditor() {
  if (!record) return;
  selected = Math.max(0, Math.min(selected, record.trip.options.length - 1));
  const trip = record.trip;
  const current = trip.options[selected];
  shell(
    `<div class="editor-title"><div><div class="eyebrow">Trip workspace</div><h1>${e(trip.origin)} → ${e(trip.destination)}</h1><div class="muted">${e(trip.travelers.join(" · "))} ${trip.title ? " / " + e(trip.title) : ""}</div></div><div class="actions"><span class="badge ${record.publishedAt ? "green" : ""}">${record.publishedAt ? "Published version available" : "Draft proposal"}</span>${button("Trip actions", "trip-actions", "small")}</div></div><div class="savebar"><span id="save-state" class="save-state">${dirty ? "Unsaved draft changes" : "Draft saved · " + e(dateLabel(record.updatedAt.slice(0, 10)))}</span><div class="actions">${button("Preview", "preview")}${button("Save draft", "save")}${button(record.publishedAt ? "Update proposal ↗" : "Publish proposal ↗", "publish", "primary")}${record.publishedAt ? button("Share link", "share") : ""}</div></div>${tripDetails()}<div class="editor-layout"><aside class="option-nav"><div class="nav-heading">Itinerary options</div>${trip.options.map((o, i) => `<button data-action="select-option" data-i="${i}" class="${i === selected ? "active" : ""}"><strong>${String(i + 1).padStart(2, "0")} &nbsp; ${e(o.title || "Untitled option")}</strong><span>${e(priceLabel(o.prices))}</span></button>`).join("")}${button("+ Add itinerary", "add-option", "primary")}</aside><div>${current ? optionEditor(current) : `<div class="empty"><div class="plane">✈</div><h2>Let’s add the first option.</h2><p>Start with a one-way, roundtrip, or multicity itinerary.<br>Look up flights or enter the details yourself.</p>${button("+ Add itinerary", "add-option", "primary")}</div>`}</div></div><datalist id="airports">${Object.entries(
      AIRPORTS,
    )
      .map(([k, v]) => `<option value="${k}">${e(v[0])}</option>`)
      .join(
        "",
      )}</datalist><datalist id="zones">${[...new Set(Object.values(AIRPORTS).map((x) => x[1]))].map((z) => `<option value="${z}"></option>`).join("")}</datalist>`,
  );
}
function optionEditor(o) {
  const p = "options." + selected;
  return `<section class="panel"><div class="panel-head"><h2>Option ${selected + 1}</h2><div class="actions">${button("Duplicate", "duplicate-option", "small")}${button("Remove", "remove-option", "small danger")}</div></div><div class="grid">${field("Option name", p + ".title", "text", 'placeholder="Via London · evening departure"')}${selectField("Itinerary type", p + ".type", ["oneway", "roundtrip", "multicity"])}</div><p>${check("Mark as recommended", p + ".recommended")}</p><div class="grid four">${selectField("Default cabin", p + ".cabin", CABINS, "Not specified")}${field("Carry-on bags", p + ".carryOn", "number", 'min="0" max="20" step="1" placeholder="Not specified"')}${field("Checked bags", p + ".checked", "number", 'min="0" max="20" step="1" placeholder="Not specified"')}${selectField("Default alliance", p + ".alliance", ALLIANCES, "Auto / per airline")}</div><p class="note">Each flight can override these defaults, including mixed cabins and baggage.</p>${field("Baggage weight / allowance notes", p + ".bagWeight", "text", 'placeholder="e.g. 23 kg per checked bag"')}<div class="panel-head"><h2>Flights</h2>${button("Reuse from this trip", "reuse", "small")}</div>${o.journeys.map((j, i) => journeyEditor(j, i, p)).join("")}${o.type === "multicity" ? button("+ Add journey", "add-journey", "small") : ""}<hr><div class="panel-head"><h2>Pricing</h2>${button("+ Add price component", "add-price", "small")}</div><p class="note">All amounts are per traveler. Enter cash, miles, or both. Taxes & fees are added to cash in the same currency.</p>${o.prices.map((price, i) => priceEditor(price, i, p)).join("")}<div class="price-total"><span>Total per traveler</span><strong id="editor-total">${e(priceLabel(o.prices))}</strong></div><p class="note" id="group-total">${record.trip.travelers.length > 1 ? e(priceLabel(o.prices, record.trip.travelers.length)) + " for " + record.trip.travelers.length + " travelers" : ""}</p>${textField("Option notes shown to travelers", p + ".notes")}</section>`;
}
function journeyEditor(j, i, p) {
  return `<section class="journey-editor"><div class="journey-head"><input aria-label="Journey name" data-path="${p}.journeys.${i}.label" value="${e(j.label)}"><div class="actions">${button("Shift dates", "shift-journey", "small", `data-j="${i}"`)}${record.trip.options[selected].type === "multicity" ? button("Remove", "remove-journey", "small danger", `data-j="${i}"`) : ""}</div></div>${j.segments.map((s, k) => `${k ? `<div class="connection">${e(connectionText(j.segments[k - 1], s))}</div>` : ""}${segmentEditor(s, i, k, p)}`).join("")}${button("+ Add flight segment", "add-segment", "small", `data-j="${i}"`)}</section>`;
}
function segmentEditor(s, j, k, p) {
  const base = `${p}.journeys.${j}.segments.${k}`;
  return `<details class="segment-editor" ${!s.verified ? "open" : ""}><summary><span>${e(s.flight || "Flight " + (k + 1))} &nbsp; ${e(s.origin || "Origin")} → ${e(s.destination || "Destination")}</span><span class="badge ${s.verified ? "green" : "amber"}">${s.verified ? "Schedule confirmed" : "Needs confirmation"}</span></summary><div class="segment-content"><div class="lookup-line">${field("Flight number", base + ".flight", "text", 'placeholder="LH413" maxlength="12"')}${field("Local departure date", base + ".depDate", "date")}${button("Look up flight", "lookup", "primary", `data-j="${j}" data-k="${k}"`)}</div><div class="grid three">${field("Departure airport", base + ".origin", "text", 'list="airports" placeholder="JFK" maxlength="4"')}${field("Departure time", base + ".depTime", "time")}${field("Departure timezone", base + ".depZone", "text", 'list="zones" placeholder="America/New_York"')}${field("Arrival airport", base + ".destination", "text", 'list="airports" placeholder="MUC" maxlength="4"')}${field("Arrival time", base + ".arrTime", "time")}${field("Arrival date", base + ".arrDate", "date")}${field("Arrival timezone", base + ".arrZone", "text", 'list="zones" placeholder="Europe/Berlin"')}${field("Airline name", base + ".airline")}${field("Aircraft type", base + ".aircraft", "text", 'placeholder="Boeing 787-9"')}</div><details class="advanced"><summary>Cabin, baggage, alliance & advanced details ⌄</summary><div class="grid three">${selectField("Cabin override", base + ".cabin", CABINS, "Use itinerary default")}${field("Carry-on override", base + ".carryOn", "number", 'min="0" max="20" step="1" placeholder="Use default"')}${field("Checked bags override", base + ".checked", "number", 'min="0" max="20" step="1" placeholder="Use default"')}${selectField("Alliance", base + ".alliance", ALLIANCES, "Use itinerary default")}${field("Operating airline", base + ".operatedBy")}${field("Airline IATA code (logo)", base + ".iata", "text", 'maxlength="2" placeholder="LH"')}${field("Baggage weight override", base + ".bagWeight")}${field("Departure UTC offset (only if needed)", base + ".depOffset", "text", 'placeholder="e.g. -04:00"')}${field("Arrival UTC offset (only if needed)", base + ".arrOffset", "text", 'placeholder="e.g. +05:30"')}</div><p class="note">UTC offsets are only needed for a manual time that occurs twice when daylight saving ends.</p></details><div class="check-row">${check("I have confirmed these flight dates and times", base + ".verified")}<div class="actions">${k ? button("↑", "move-segment", "small", `data-j="${j}" data-k="${k}" aria-label="Move flight up"`) : ""}${button("Remove", "remove-segment", "small danger", `data-j="${j}" data-k="${k}"`)}</div></div><p class="segment-status">${e(s.source || "Manual entry")} · ${minutesLabel(duration(s))}${s.fetchedAt ? " · retrieved " + e(dateLabel(s.fetchedAt.slice(0, 10))) : ""}</p></div></details>`;
}
function priceEditor(price, i, p) {
  const b = `${p}.prices.${i}`;
  return `<div class="price-row"><div class="grid three">${field("Component / ticket", b + ".label", "text", 'placeholder="Outbound award / return cash"')}${selectField("Cash & fees currency", b + ".currency", CURRENCIES)}<div class="actions">${button("Remove component", "remove-price", "ghost small danger", `data-i="${i}"`)}</div>${field("Cash fare", b + ".cash", "number", 'min="0" max="1000000000" step="0.01" placeholder="0"')}${field("Miles / points", b + ".miles", "number", 'min="0" max="1000000000" step="1" placeholder="0"')}${field("Mileage program", b + ".program", "text", 'placeholder="Aeroplan points"')}${field("Taxes & fees", b + ".fees", "number", 'min="0" max="1000000000" step="0.01" placeholder="0"')}</div></div>`;
}
async function saveDraft() {
  if (locked) return;
  locked = true;
  app.inert = true;
  try {
    const updated = await api("trips/" + record.id, "PUT", {
      revision: record.revision,
      trip: record.trip,
    });
    record = updated;
    dirty = false;
    renderEditor();
    toast("Draft saved. Published version is unchanged.");
    return true;
  } finally {
    app.inert = false;
    locked = false;
  }
}
async function publish() {
  if (!(await saveDraft())) return;
  const problems = record.trip.options.flatMap((o, i) =>
    optionIssues(o).map((x) => `Option ${i + 1}: ${x}`),
  );
  if (problems.length) {
    const err = Error("Complete these details before publishing.");
    err.issues = problems;
    throw err;
  }
  app.inert = true;
  try {
    record = await api("trips/" + record.id + "/publish", "POST", {
      revision: record.revision,
    });
    renderEditor();
    toast("Proposal published. Your share link shows this version.");
    share();
  } finally {
    app.inert = false;
  }
}
function share() {
  const link = location.origin + "/?share=" + record.shareToken;
  modal(
    "Share this proposal",
    `<p>Anyone with this link can view the published proposal.</p><label>Customer link<input id="share-link" readonly value="${e(link)}"></label><div class="dialog-footer"><a href="${e(link)}" target="_blank" rel="noopener noreferrer">Open customer view ↗</a>${button("Copy link", "copy-link", "primary")}</div>`,
  );
}
function addOption() {
  modal(
    "Add an itinerary",
    `<form id="modal-form"><div class="grid"><label>Itinerary type<select name="type"><option value="roundtrip">Roundtrip</option><option value="oneway">One-way</option><option value="multicity">Multicity</option></select></label><label>Starting dates<select name="dateSet">${record.trip.dateSets.map((d, i) => `<option value="${i}">${i ? "Alternative " + i : "Primary"}: ${e(dateLabel(d.departure))}${d.return ? " — " + e(dateLabel(d.return)) : ""}</option>`).join("")}</select></label></div><div class="dialog-footer"><button type="submit" class="primary">Add itinerary</button></div></form>`,
    async (f) => {
      if (record.trip.options.length >= 100)
        throw Error("Maximum 100 options per trip.");
      const d = record.trip.dateSets[Number(f.get("dateSet"))],
        o = newOption(f.get("type"), d);
      if (o.type === "multicity")
        o.journeys.push(newJourney("Journey 2", d.return || d.departure));
      record.trip.options.push(o);
      selected = record.trip.options.length - 1;
      dirtyMark();
      dialog.close();
      renderEditor();
    },
  );
}
function duplicateOption() {
  const o = record.trip.options[selected];
  modal(
    "Duplicate itinerary",
    `<form id="modal-form"><p class="note">The copy is independent. New dates retain the connection day offsets; confirm or look up the copied schedules before publishing.</p><div class="grid">${o.journeys.map((j, i) => `<label>${e(j.label)} departure<input type="date" name="date${i}" value="${e(j.segments[0]?.depDate || "")}"></label>`).join("")}</div><div class="dialog-footer"><button type="submit" class="primary">Create copy</button></div></form>`,
    async (f) => {
      if (record.trip.options.length >= 100)
        throw Error("Maximum 100 options per trip.");
      record.trip.options.push(
        copyOption(
          o,
          o.journeys.map((_, i) => f.get("date" + i)),
        ),
      );
      selected = record.trip.options.length - 1;
      dirtyMark();
      dialog.close();
      renderEditor();
    },
  );
}
function reuseModal() {
  const o = record.trip.options[selected];
  const sources = [];
  record.trip.options.forEach((opt, oi) =>
    opt.journeys.forEach((j, ji) => {
      sources.push({
        oi,
        ji,
        si: -1,
        text: `Option ${oi + 1} · ${j.label} · whole journey`,
      });
      j.segments.forEach((s, si) =>
        sources.push({
          oi,
          ji,
          si,
          text: `Option ${oi + 1} · ${j.label} · ${s.flight || "Flight " + (si + 1)} ${s.origin} → ${s.destination}`,
        }),
      );
    }),
  );
  if (!sources.length) throw Error("Add a flight to the trip first.");
  modal(
    "Reuse flights from this trip",
    `<form id="modal-form"><div class="grid"><label class="full">Choose a saved flight or journey<select name="source" id="reuse-source">${sources.map((s, i) => `<option value="${i}">${e(s.text)}</option>`).join("")}</select></label><label>Append to journey<select name="target">${o.journeys.map((j, i) => `<option value="${i}">${e(j.label)}</option>`).join("")}</select></label><label>New first departure date <span class="muted">leave blank to retain dates</span><input type="date" name="date"></label></div><p class="note">Flights are copied, leaving the source unchanged. To copy an entire roundtrip, use Duplicate on its option.</p><div class="dialog-footer"><button class="primary" type="submit">Copy flights</button></div></form>`,
    async (f) => {
      const src = sources[Number(f.get("source"))],
        j = record.trip.options[src.oi].journeys[src.ji],
        source = src.si < 0 ? j : { ...j, segments: [j.segments[src.si]] };
      const copied = copyJourney(source, f.get("date"));
      const target = o.journeys[Number(f.get("target"))];
      if (target.segments.length + copied.segments.length > 20)
        throw Error(
          "Maximum 20 flights per journey. Remove the blank flight first if necessary.",
        );
      target.segments.push(...copied.segments);
      dirtyMark();
      dialog.close();
      renderEditor();
    },
  );
}
function shiftJourney(index) {
  const j = record.trip.options[selected].journeys[index];
  if (!j.segments.length) throw Error("Add a flight before shifting dates.");
  modal(
    "Shift journey dates",
    `<form id="modal-form"><label>New first departure date<input type="date" name="date" value="${e(j.segments[0].depDate)}" required></label><p class="note">All arrival and connection dates shift together. Times must be confirmed again when the date changes.</p><div class="dialog-footer"><button type="submit" class="primary">Apply new dates</button></div></form>`,
    async (f) => {
      record.trip.options[selected].journeys[index] = copyJourney(
        j,
        f.get("date"),
      );
      dirtyMark();
      dialog.close();
      renderEditor();
    },
  );
}
async function lookupFlight(j, k) {
  if (lookupBusy) {
    toast("One flight lookup is already in progress.");
    return;
  }
  const optionIndex = selected,
    s = record.trip.options[selected].journeys[j].segments[k];
  flightIdent(s.flight);
  if (!validDate(s.depDate))
    throw Error("Enter the local departure date first.");
  const input = { flight: s.flight, date: s.depDate },
    originalId = s.id;
  lookupBusy = true;
  let cancelled = false;
  modal(
    "Looking up " + s.flight,
    `<p id="lookup-message" class="notice">Finding schedules for ${e(dateLabel(s.depDate))}…</p><p class="note">Requests are paced to stay within the base plan’s limits.</p>${button("Cancel", "close-dialog")}`,
  );
  const onClose = () => {
    cancelled = true;
  };
  dialog.addEventListener("close", onClose, { once: true });
  try {
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await api("lookup", "POST", input);
        break;
      } catch (err) {
        if (err.status !== 429 || attempt === 2 || err.retryAfter > 60)
          throw err;
        const sec = Math.max(1, err.retryAfter || 15);
        const el = document.querySelector("#lookup-message");
        if (el)
          el.textContent = `Waiting ${sec} seconds for the lookup cooldown. Retry ${attempt + 1} of 2…`;
        await new Promise((r) => setTimeout(r, sec * 1000));
        if (cancelled) return;
      }
    }
    if (cancelled) return;
    modal(
      "Choose flight",
      `<p class="notice">${e(result.message)}${result.cached ? " Using a recently saved lookup." : ""}</p>${result.flights.map((f, i) => `<button class="result" data-result="${i}">${e(f.flight)} · ${e(f.origin)} → ${e(f.destination)}<span>${e(dateLabel(f.depDate))} ${e(f.depTime)} → ${e(dateLabel(f.arrDate))} ${e(f.arrTime)} · ${e(f.aircraft || "Aircraft not specified")}</span></button>`).join("")}${!result.flights.length ? '<p class="note">Close this window to enter the details manually.</p>' : ""}`,
    );
    dialog.querySelectorAll("[data-result]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const target =
          record?.trip.options[optionIndex]?.journeys[j]?.segments[k];
        if (!target || target.id !== originalId) {
          dialog.close();
          toast("The itinerary changed. Please look up this flight again.");
          return;
        }
        const f = result.flights[Number(btn.dataset.result)];
        Object.assign(target, f, {
          id: originalId,
          cabin: target.cabin,
          carryOn: target.carryOn,
          checked: target.checked,
          bagWeight: target.bagWeight,
          depOffset: "",
          arrOffset: "",
        });
        dirtyMark();
        dialog.close();
        renderEditor();
      }),
    );
  } catch (err) {
    if (!cancelled) errorDialog(err);
  } finally {
    lookupBusy = false;
    dialog.removeEventListener("close", onClose);
  }
}
function tripActions() {
  modal(
    "Trip actions",
    `<div class="actions">${record.publishedAt ? button("Unpublish proposal", "unpublish") : ""}${button("Replace share link", "rotate-link")}${button("Delete trip", "delete-trip", "danger")}</div><p class="note">Replacing the link makes the previous link stop working. Unpublishing hides the customer proposal while keeping your draft.</p>`,
  );
}
async function tripMutation(action) {
  if (dirty) throw Error("Save your draft before changing sharing settings.");
  record = await api(`trips/${record.id}/${action}`, "POST", {
    revision: record.revision,
  });
  dialog.close();
  renderEditor();
  toast(
    action === "unpublish" ? "Proposal unpublished." : "Share link replaced.",
  );
}
document.addEventListener("submit", async (event) => {
  if (!["login-form", "modal-form"].includes(event.target.id)) return;
  event.preventDefault();
  const form = event.target,
    submit = form.querySelector("[type=submit]");
  if (submit) submit.disabled = true;
  try {
    if (form.id === "login-form") {
      await api("login", "POST", {
        passcode: new FormData(form).get("passcode"),
      });
      await showHome();
    } else if (dialogAction) {
      await dialogAction(new FormData(form));
    }
  } catch (err) {
    if (form.id === "login-form") login(err.message);
    else {
      let el = form.querySelector(".form-error");
      if (!el) {
        el = document.createElement("p");
        el.className = "notice error form-error";
        form.prepend(el);
      }
      el.textContent = err.message;
    }
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.dataset.path) {
    pathSet(el.dataset.path, el.type === "checkbox" ? el.checked : el.value);
    if (el.dataset.path.includes(".prices.")) {
      const o = record.trip.options[selected];
      document.querySelector("#editor-total").textContent = priceLabel(
        o.prices,
      );
      document.querySelector("#group-total").textContent =
        record.trip.travelers.length > 1
          ? priceLabel(o.prices, record.trip.travelers.length) +
            " for " +
            record.trip.travelers.length +
            " travelers"
          : "";
    }
  }
  if (el.id === "travelers") {
    record.trip.travelers = el.value
      .split("\n", 101)
      .map((s) => s.trim())
      .filter(Boolean);
    dirtyMark();
  }
  if (el.id === "trip-search") {
    const pos = el.selectionStart;
    renderHome(el.value);
    const next = document.querySelector("#trip-search");
    next.focus();
    next.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", (event) => {
  const el = event.target,
    path = el.dataset.path;
  if (el.id === "create-type") {
    const r = document.querySelector("#create-return");
    r.classList.toggle("hidden", el.value === "oneway");
    r.querySelector("input").required = el.value === "roundtrip";
  }
  if (el.id === "sort") {
    sort = el.value;
    if (publicData)
      shell(proposalHTML(publicData.trip, publicData.publishedAt), true);
    else
      modal(
        "Customer preview",
        proposalHTML(record.trip, null, true),
        null,
        true,
      );
  }
  if (!path) return;
  try {
    if (path === "type") {
      renderEditor();
      document.querySelector(".trip-details").open = true;
    }
    if (/^options\.\d+\.type$/.test(path)) {
      const o = record.trip.options[selected],
        target = o.type === "oneway" ? 1 : 2;
      if (o.journeys.length > target && o.type !== "multicity") {
        if (
          confirm(
            "Changing the itinerary type removes extra journeys. Continue?",
          )
        )
          o.journeys = o.journeys.slice(0, target);
        else o.type = o.journeys.length > 2 ? "multicity" : "roundtrip";
      }
      for (let count = 0; o.journeys.length < target && count < 2; count++)
        o.journeys.push(
          newJourney(
            o.type === "roundtrip"
              ? "Inbound"
              : "Journey " + (o.journeys.length + 1),
            record.trip.dateSets[0]?.return || "",
          ),
        );
      if (o.type === "roundtrip") {
        o.journeys[0].label = "Outbound";
        o.journeys[1].label = "Inbound";
      }
      renderEditor();
    }
    const m = path.match(
      /^options\.(\d+)\.journeys\.(\d+)\.segments\.(\d+)\.(\w+)$/,
    );
    if (m) {
      const s = record.trip.options[+m[1]].journeys[+m[2]].segments[+m[3]],
        key = m[4];
      if (
        [
          "flight",
          "origin",
          "destination",
          "depDate",
          "depTime",
          "depZone",
          "arrDate",
          "arrTime",
          "arrZone",
          "depOffset",
          "arrOffset",
        ].includes(key)
      ) {
        s.verified = false;
        if (key.startsWith("dep")) {
          delete s.depUTC;
          if (key !== "depOffset") delete s.depOffset;
        }
        if (key.startsWith("arr")) {
          delete s.arrUTC;
          if (key !== "arrOffset") delete s.arrOffset;
        }
      }
      if (key === "origin" || key === "destination") {
        const code = s[key].trim().toUpperCase(),
          prefix = key === "origin" ? "dep" : "arr";
        s[key] = code;
        s[prefix + "Zone"] = AIRPORTS[code]?.[1] || "";
        delete s[prefix + "UTC"];
        delete s[prefix + "Offset"];
      }
      if (key === "flight") {
        try {
          const f = flightIdent(s.flight);
          s.flight = f.display;
          s.iata = f.iata;
          s.airline = f.airline;
          s.alliance = f.alliance;
        } catch {}
      }
      const card = el.closest(".segment-editor");
      card.querySelectorAll("[data-path]").forEach((input) => {
        const value = pathGet(input.dataset.path);
        if (input.type === "checkbox") input.checked = !!value;
        else input.value = value ?? "";
      });
      card.querySelector("summary>span").textContent =
        (s.flight || "Flight " + (+m[3] + 1)) +
        "  " +
        (s.origin || "Origin") +
        " → " +
        (s.destination || "Destination");
      const badge = card.querySelector("summary .badge");
      badge.textContent = s.verified
        ? "Schedule confirmed"
        : "Needs confirmation";
      badge.className = "badge " + (s.verified ? "green" : "amber");
      card.querySelector(".segment-status").textContent =
        (s.source || "Manual entry") + " · " + minutesLabel(duration(s));
      const section = el.closest(".journey-editor"),
        segments = record.trip.options[+m[1]].journeys[+m[2]].segments;
      section
        .querySelectorAll(".connection")
        .forEach(
          (node, index) =>
            (node.textContent = connectionText(
              segments[index],
              segments[index + 1],
            )),
        );
    }
  } catch (err) {
    errorDialog(err);
  }
});
document.addEventListener("click", async (event) => {
  const b = event.target.closest("[data-action]");
  if (!b || b.disabled || locked) return;
  const a = b.dataset.action,
    j = Number(b.dataset.j),
    k = Number(b.dataset.k),
    i = Number(b.dataset.i);
  try {
    const o = record?.trip.options[selected];
    switch (a) {
      case "close-dialog":
        dialog.close();
        break;
      case "home":
        await showHome();
        break;
      case "logout":
        if (dirty && !confirm("Sign out without saving changes?")) return;
        await api("logout", "POST", {});
        dirty = false;
        history.replaceState(null, "", "/");
        login();
        break;
      case "create-trip":
        createTrip();
        break;
      case "open-trip":
        await openTrip(b.dataset.id);
        break;
      case "next-page":
        await showHome(listPage + 1);
        break;
      case "prev-page":
        await showHome(listPage - 1);
        break;
      case "select-option":
        selected = i;
        renderEditor();
        break;
      case "add-option":
        addOption();
        break;
      case "save":
        await saveDraft();
        break;
      case "publish":
        await publish();
        break;
      case "preview":
        modal(
          "Customer preview",
          proposalHTML(record.trip, null, true),
          null,
          true,
        );
        break;
      case "share":
        share();
        break;
      case "copy-link":
        try {
          await navigator.clipboard.writeText(
            document.querySelector("#share-link").value,
          );
          toast("Link copied.");
        } catch {
          document.querySelector("#share-link").select();
          toast("Select and copy this link.");
        }
        break;
      case "trip-actions":
        tripActions();
        break;
      case "unpublish":
        if (confirm("Hide this proposal from anyone with the link?"))
          await tripMutation("unpublish");
        break;
      case "rotate-link":
        if (
          confirm(
            "Replace the share link? The previous link will stop working.",
          )
        )
          await tripMutation("rotate-link");
        break;
      case "delete-trip":
        if (
          confirm("Permanently delete this trip and its published proposal?")
        ) {
          await api("trips/" + record.id, "DELETE", {
            revision: record.revision,
          });
          dirty = false;
          dialog.close();
          await showHome();
        }
        break;
      case "duplicate-option":
        duplicateOption();
        break;
      case "reuse":
        reuseModal();
        break;
      case "shift-journey":
        shiftJourney(j);
        break;
      case "lookup":
        await lookupFlight(j, k);
        break;
      case "add-dates":
        if (record.trip.dateSets.length >= 30)
          throw Error("Maximum 30 date combinations.");
        record.trip.dateSets.push({ departure: "", return: "" });
        dirtyMark();
        renderEditor();
        document.querySelector(".trip-details").open = true;
        break;
      case "remove-dates":
        record.trip.dateSets.splice(i, 1);
        dirtyMark();
        renderEditor();
        document.querySelector(".trip-details").open = true;
        break;
      case "remove-option":
        if (confirm("Remove this itinerary option from the draft?")) {
          record.trip.options.splice(selected, 1);
          dirtyMark();
          renderEditor();
        }
        break;
      case "add-journey":
        if (o.journeys.length >= 20) throw Error("Maximum 20 journeys.");
        o.journeys.push(newJourney("Journey " + (o.journeys.length + 1)));
        dirtyMark();
        renderEditor();
        break;
      case "remove-journey":
        if (confirm("Remove this journey and its flights?")) {
          o.journeys.splice(j, 1);
          dirtyMark();
          renderEditor();
        }
        break;
      case "add-segment":
        if (o.journeys[j].segments.length >= 20)
          throw Error("Maximum 20 flights per journey.");
        o.journeys[j].segments.push(
          newSegment(
            o.journeys[j].segments.at(-1)?.arrDate ||
              record.trip.dateSets[0].departure,
          ),
        );
        dirtyMark();
        renderEditor();
        break;
      case "remove-segment":
        if (confirm("Remove this flight segment?")) {
          o.journeys[j].segments.splice(k, 1);
          dirtyMark();
          renderEditor();
        }
        break;
      case "move-segment": {
        const ss = o.journeys[j].segments;
        [ss[k - 1], ss[k]] = [ss[k], ss[k - 1]];
        dirtyMark();
        renderEditor();
        break;
      }
      case "add-price":
        if (o.prices.length >= 100)
          throw Error("Maximum 100 price components.");
        o.prices.push({
          id: uid(),
          label: "",
          cash: "",
          miles: "",
          program: "",
          fees: "",
          currency: "USD",
        });
        dirtyMark();
        renderEditor();
        break;
      case "remove-price":
        o.prices.splice(i, 1);
        dirtyMark();
        renderEditor();
        break;
    }
  } catch (err) {
    errorDialog(err);
  }
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has("share")) {
      publicData = await api(
        "share/" + encodeURIComponent(params.get("share")),
      );
      shell(proposalHTML(publicData.trip, publicData.publishedAt), true);
      return;
    }
    await api("session");
    if (params.has("trip")) await openTrip(params.get("trip"));
    else await showHome();
  } catch (err) {
    if (params.has("share"))
      shell(
        `<div class="empty"><h1>Proposal unavailable</h1><p>${e(err.message)}</p></div>`,
        true,
      );
    else if (err.status === 401) login();
    else login(err.message);
  }
}
boot();
