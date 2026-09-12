# Flight proposals

A complete flight proposal tool for GitHub → Cloudflare Pages + D1. No application dependencies, package installation, or package-lock.json needed.

## Deploy through GitHub and Cloudflare

1. **Create a GitHub repository.** Unzip this project and upload the contents of the `flight-proposals` folder to the repository root. `package.json`, `public`, `functions`, `server`, and `migrations` must be at the root, not nested inside another project folder. Include `.npmrc`; it disables lockfile generation. Do not upload `.dev.vars` or a local SQLite database.
2. **Create a D1 database.** In Cloudflare, open **Storage & databases → D1 → Create database**. A name such as `flight-proposals` is fine.
3. **Initialize it.** Open the database’s **Console**, paste the entire contents of `migrations/0001_initial.sql`, and run it. The migration can be run again safely; it does not erase trips.
4. **Create a Pages project connected to your GitHub repository.** Select **Workers & Pages → Create application → Pages → Connect to Git** (dashboard wording can vary). Choose framework **None**, build command **`npm run build`**, output directory **`dist`**, and leave the root directory blank if the files are at the repository root. Use Node 22 or 24; `NODE_VERSION=22` can be set as a build environment variable if needed. There are no application dependencies to install.
5. **Add the database binding.** In the Pages project, **Settings → Bindings → Add → D1 database**. Set the variable name to **`DB`**, then select the database from step 2. You do not need to paste the database ID into application code.
6. **Add encrypted secrets** under the Pages project’s **Settings → Variables and Secrets**:

   | Secret name           | Value                                                |
   | --------------------- | ---------------------------------------------------- |
   | `ADMIN_PASSCODE`      | Your private admin passcode, at least 12 characters. |
   | `FLIGHTAWARE_API_KEY` | Your AeroAPI key from your FlightAware account.      |

   Configure these for **Production**. If using Preview deployments, bind a separate test D1 database and set preview secrets as well. The AeroAPI key is optional for manual entry. Never use a `VITE_` prefix or put either secret in GitHub, JavaScript, or HTML.

7. **Redeploy after adding bindings and secrets.** Open your `pages.dev` address and sign in using the admin passcode. Create a trip, add an itinerary, save it, then publish. The Share link is the customer dashboard. Updating the code from GitHub does not erase D1 data.

Use a Git-connected **Pages build**, not a drag-and-drop upload of only the static `dist` folder: the root `functions` and `server` directories are required for the API. Cloudflare bundles the Pages Functions separately.

Cloudflare references: [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [D1 bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/).

## What is included

- Trips with traveler names, cities, notes, primary dates and up to 29 alternative date combinations.
- One-way, roundtrip and multicity options, multiple connecting segments per journey, cabin/baggage defaults and per-flight overrides.
- AeroAPI lookups by airline flight number and local departure date, including the future schedule endpoint. Imported details remain editable.
- Manual entry for every field, including airport timezone and optional UTC offset for an ambiguous daylight-saving time.
- Google’s public airline-logo image pattern, using IATA codes. No second API account required. A failed image is hidden and the airline name remains visible. This is an undocumented CDN asset pattern, not a supported logo API or an availability guarantee.
- Cash, miles, fees, or mixed price components. Per-traveler pricing and group totals. USD default; INR and EUR available. Different currencies and mileage programs are never converted or combined with each other.
- Copy one segment or a whole journey from any option in the trip. Duplicate a whole itinerary with separate new dates for each journey.
- Admin passcode login, authenticated server-side API, revocable opaque share links, draft/published snapshots, and checks against overwriting edits from another tab.
- Google Flights integration is intentionally omitted.

## Daily workflow

1. Create a trip and enter each traveler on a separate line. Add alternative dates in **Trip details & dates**.
2. Add an itinerary and choose a starting date combination. Dates on individual options can differ from the trip’s primary dates.
3. Enter a flight number and its **local departure date**, then click **Look up flight**. Select the matching route from the results. The client never guesses between multiple results.
4. If entering manually, fill both airports, both local dates/times, and both airport timezones. Common airport codes autofill a timezone; other airports accept an explicit IANA timezone, such as `Europe/Berlin` or `Asia/Kolkata`.
5. Add connecting flights. Elapsed flight/layover durations use UTC internally, while all visible dates/times stay local to their airports. Airport changes are flagged.
6. Set cabin and bags. A blank bag count means unspecified; `0` explicitly means no bag allowance. Weight limits can be entered as text.
7. Add pricing components, for example `Outbound award: 60,000 Aeroplan points + $85 fees`, and `Return cash: $620`. Total: **60,000 Aeroplan points + $705 per traveler**. Do not enter fees again if already included in the cash amount: split the base fare and fees, or put the entire cash total in Cash fare and leave Fees blank.
8. Confirm manually entered or date-shifted schedules with the checkbox. Imported schedules arrive confirmed. Changing flight dates, times, airports or identifiers removes confirmation.
9. **Save draft** preserves your working copy. **Preview** shows it privately. **Publish / Update proposal** saves and publishes the current complete trip. All options must have complete, confirmed schedules. Customers continue to see the previous published version until you publish again.
10. Use **Share link** to copy the trip-specific customer link. Anyone with it can view; customers cannot edit. **Trip actions** provides unpublish, link replacement, and deletion.

Unsaved edits remain in the open page only. Save before leaving; the app warns before navigating away. Drafts are not sent to the customer endpoint.

## Reuse and date shifts

- **Reuse from this trip:** choose a segment or a whole journey, a target journey, and optionally a new first departure date. Copied flights are appended; remove an unused blank segment if necessary.
- **Duplicate:** copies the selected entire itinerary, including price components. Choose independent outbound/return dates in the dialog.
- **Shift dates:** moves an existing journey’s dates together, preserving overnight and onward-connection day offsets.
- Date changes keep the old local times for convenience, clear stored UTC values/offsets and require confirmation. They do **not** claim the same schedule operates on the new date. Refresh each copied flight using Look up, or verify manually.
- Copies get new IDs and do not modify the original option.

## Date behavior

The displayed calendar dates are stored as explicit `YYYY-MM-DD` strings. The renderer does not convert them into viewer-local dates. This prevents a browser in another timezone from displaying the previous day.

FlightAware UTC timestamps are converted using the origin timezone for departure and destination timezone for arrival. Candidate flights are accepted only when the origin-local departure date matches the date you requested. The code will not relabel an adjacent day’s flight.

Durations are calculated from UTC timestamps resolved from each flight’s saved local date/time and timezone. Daylight saving and half-hour offsets are accounted for. Nonexistent DST times are rejected. Repeated DST times require an imported UTC timestamp or a manual offset under advanced details.

## FlightAware coverage and request controls

- Uses `/schedules/{date_start}/{date_end}` for airline schedules, including future dates, with a padded UTC search window and a local-date match. The input supports up to 365 days ahead and 90 days back. Actual airline schedule availability and your account’s endpoint access still control what can be returned.
- Common IATA ↔ ICAO mappings are bundled, including LH/DLH, VS/VIR and AI/AIC. Other airlines are resolved through the operators endpoint. Unknown identifiers are never silently reassigned.
- Uses **scheduled gate departure/arrival** times for proposals, not live position or takeoff timestamps.
- A shared D1 gate spaces outbound requests by at least seven seconds. This applies across server instances and covers pagination and metadata lookups. It is intentionally conservative for the Personal tier.
- One result page per external request, no more than three schedule pages per lookup, and no more than eight uncached external calls per lookup. If results are partial, the UI says so. The app never follows arbitrary pagination URLs with your API key.
- Requests and successful lookups are cached for one hour; empty lookups for five minutes. Duplicate lookups are locked while in progress. Airline/airport metadata is also cached with the raw response cache.
- Provider 429 responses trigger a shared cooldown. The UI makes at most two delayed retries, and stops automatically retrying when the indicated wait exceeds 60 seconds. No infinite retry loops. If other apps use the same key, their usage also counts against your account’s limits.
- Customer views read the published D1 snapshot and make **no FlightAware calls**. Draft edits do not automatically trigger lookups or background schedule refreshes.
- A base/Personal account is not an unlimited free API. FlightAware lists usage-based pricing and a monthly free credit. Check usage in your account. No price, award availability, fare-specific cabin or baggage data is fetched by this tool.

References: [AeroAPI pricing and limits](https://www.flightaware.com/commercial/aeroapi/), [FlightAware future-schedules discussion](https://discussions.flightaware.com/t/flight-schedule-data/85435), [AeroAPI developer portal](https://www.flightaware.com/aeroapi/portal/documentation).

## Run locally (optional)

Use Node 22.13+ or Node 24. No npm install is required.

1. Copy `.dev.vars.example` to `.dev.vars` and set your passcode and optional AeroAPI key.
2. Run `npm run dev`.
3. Open `http://localhost:8788`.

The local server uses Node’s built-in SQLite engine, runs the same API code/SQL, and saves to `local.sqlite` by default. This database is separate from Cloudflare D1 and is excluded from Git.

Run `npm test` for the automated suite and `npm run build` to create `dist`. Build scripts enforce the absence of `package-lock.json`. Application limits are far below 100,000 iterations: maximum 100 options/trip, 20 journeys/option, 20 segments/journey, 100 price components/option, and 500 KB per saved trip. No unbounded loops or retries are used in application code.

## Files

| Path                          | Purpose                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `public/app.js`               | Admin UI, itinerary editor, reuse dialogs and customer view                     |
| `public/core.js`              | Shared date, timezone, price and copying logic; airline/airport reference lists |
| `public/style.css`            | Responsive desktop/mobile design                                                |
| `server/api.js`               | Authentication, drafts, publication and shared proposals                        |
| `server/aero.js`              | AeroAPI adapter, cache, lookup locks and shared request pacing                  |
| `server/validation.js`        | Server-side input limits and publishing checks                                  |
| `functions/api/[[path]].js`   | Cloudflare Pages Functions entrypoint                                           |
| `migrations/0001_initial.sql` | D1 database schema                                                              |
| `tests/`                      | Automated regression tests                                                      |

## Validation and remaining live checks

Automated tests cover local-date rendering across viewer timezones, DST transitions, midnight/overnight dates, IATA/ICAO normalization, cash/miles totals, independent copies, draft/publish isolation, link revocation, authentication, conflict handling, API caching and simulated provider rate-limit/access failures.

Browser checks passed for creating a trip, manually entering a four-flight roundtrip, mixed award/cash pricing, saving and publishing, opening an anonymous customer page in a different timezone, expanding layovers, keeping new drafts private, duplicating with new dates, and reusing an individual segment. Desktop and 390-pixel mobile layouts were checked for horizontal overflow and JavaScript runtime errors.

No real AeroAPI key was supplied during development. The live key/account combination and Cloudflare production deployment therefore still need a smoke test after setup: look up one known near-term flight and one published future schedule, confirm the origin-local departure date, then publish and open the customer link in a private browser window.

Airline alliance membership is a bundled, editable reference list, not a live membership feed. Aircraft and schedules can change. Connection durations do not validate airline minimum connection rules or through-ticket protection. Pricing is a proposal, not a live booking quote.
