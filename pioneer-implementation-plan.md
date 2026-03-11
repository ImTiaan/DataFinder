# Implementation Plan: PioneerDJSpare Parts (repair.pioneerdj.com)

This plan implements the workflow described in [scope.md](file:///Users/t333btc/Documents/Test%20Scraper/scope.md#L1-L8) in a way that is resilient, resumable, and mindful of potential rate limits.

## Objectives
- Log in to `https://repair.pioneerdj.com/login/` using credentials stored in `.env`.
- Complete TOTP-based 2FA using the TOTP secret from `.env` (no secrets committed to Git).
- From the dashboard, download the “full parts list” CSV via the “Request parts list” button.
- For each part number listed in **column C** of the downloaded CSV:
  - Search for it in `https://repair.pioneerdj.com/login/sps/customer/part-search/`.
  - Determine a single availability outcome using the rules below.
- Produce an enriched CSV (original rows preserved) with an added `availability` column.

## Availability Rules (binary outcomes)
We only care about these outcomes:
- **Available**: the UI indicates it is in stock (for example, “In Stock” and/or a numeric stock value). We do not capture quantities.
- **Backorder**: the stock text says “Backorder”, and the UI shows an **Add to Cart** button (orderable).
- **Not available**: the stock text says “Backorder”, but the UI shows **NSP** (not orderable / treat as discontinued for ordering purposes).

If a part does not match any of the above cleanly (for example, it returns no results), mark `availability` as **Unknown** and include a short `availability_note` column so it can be reviewed.

## Security and Data Handling
- Never copy credentials or TOTP secrets into any tracked file (including `.env.example`).
- `.env` is already ignored by Git via [.gitignore](file:///Users/t333btc/Documents/Test%20Scraper/.gitignore#L1-L6).
- Use a persistent browser profile directory (already supported by the project) so sessions can be reused and 2FA prompts minimised.
- Store outputs under `outputs/` only (also ignored by Git).

## High-Level Architecture
Use Playwright with a **persistent context**:
- Keeps cookies/session across runs to reduce login frequency.
- Allows clean retry behaviour without re-authenticating each time.

Produce results incrementally:
- Download the parts list CSV.
- Parse and build a queue of part numbers from column C.
- Iterate the queue slowly (rate-limited), scraping the part search result.
- Write an enriched CSV as we go (resumable).

## Phase 0: One-time Selector Discovery (quick validation)
Goal: identify stable selectors for Pioneer’s portal so the automation is robust.

1) Login page:
- Username input
- Password input
- Submit button

2) 2FA page (TOTP):
- TOTP input
- Submit/verify button

3) Dashboard page:
- “Request parts list” button
- Any indicator that the download has started/finished (Playwright download event is preferred)

4) Part search page:
- Search input (part number)
- Search/submit button
- Result row(s) container
- Stock status element (e.g., a `<p class="status ...">…</p>` or equivalent)
- CTA button element text (e.g., “Add to Cart” vs “NSP”)

Deliverable: a short selector map (kept inside the code, not as a separate document unless needed).

## Phase 1: Login and Session Persistence
Goal: authenticate once, reuse often.

1) Start persistent browser context (profile dir).
2) Navigate to `https://repair.pioneerdj.com/login/`.
3) Enter username/password from `.env`.
4) Submit.
5) If prompted for 2FA:
- Generate a TOTP code from the Base32 TOTP secret in `.env`.
- Enter code and submit.
6) Confirm successful login by:
- URL contains `/sps/customer/`, or
- Presence of expected navigation elements (e.g., “Part Search” in sidebar).

Resilience:
- If already logged in (valid session), skip login steps and go straight to the dashboard.
- If redirected back to login mid-run, re-authenticate once and resume.

## Phase 2: Download the Full Parts List CSV
Goal: reliably obtain the official full list from the portal.

1) Navigate to: `https://repair.pioneerdj.com/login/sps/customer/dashboard`
2) Click “Request parts list”.
3) Capture the download using the browser’s download mechanism (avoid “manual save as”).
4) Save the file into `outputs/` with a timestamped name, for example:
- `pioneer-partslist-YYYYMMDD-HHMMSS.csv`

Validation:
- Confirm the file exists and is non-empty.
- Confirm column C contains part numbers (at least on a sample of rows).

## Phase 3: Parse CSV and Build a Work Queue
Goal: extract unique part numbers and prepare a resumable queue.

1) Parse the CSV.
2) Extract part numbers from column C:
- Trim whitespace.
- Normalise casing if needed (keep original value somewhere if required).
- De-duplicate.
3) Create a queue list of part numbers.

Resumability (important for rate limiting + long runs):
- Maintain a lightweight progress file under `outputs/` (e.g., JSON) mapping:
  - part number → availability + notes + timestamp
- On restart, skip any part numbers already processed.

## Phase 4: Part Search Scrape Loop (Rate-Limit Friendly)
Goal: search each part number and classify availability safely.

For each part number:
1) Navigate to the part search page and search the part.
2) Identify the correct result row (in case multiple rows are shown).
3) Extract:
- `stock_text` (e.g., “Backorder”, “In Stock”, etc.)
- `cta_text` (e.g., “Add to Cart”, “NSP”)
4) Apply rules:
- If stock indicates in-stock (including numeric stock): `availability = Available`
- Else if stock indicates Backorder and CTA is Add to Cart: `availability = Backorder`
- Else if stock indicates Backorder and CTA is NSP: `availability = Not available`
- Else: `availability = Unknown` (include `availability_note`)

### Rate limiting strategy
Start conservatively and scale only if stable.
- These values are configurable via `.env` (and mirrored in [.env.example](file:///Users/t333btc/Documents/Test%20Scraper/.env.example)).
- **Concurrency:** `SCRAPE_CONCURRENCY` (default: 1; single tab reused).
- **Delay:** `SCRAPE_DELAY_MS_MIN`–`SCRAPE_DELAY_MS_MAX` (default: 800–1500ms randomised delay between searches).
- **Backoff:** `SCRAPE_BACKOFF_MS_MIN`–`SCRAPE_BACKOFF_MS_MAX` (default: 5–30 seconds; exponential backoff on repeated failures).
- **Retry policy:** `SCRAPE_MAX_RETRIES` (default: 3 retries for transient failures).
- **Circuit breaker:** `SCRAPE_CIRCUIT_BREAKER_FAILURES` (default: 10 consecutive failures before stopping).

### Anti-bot / portal stability considerations
- Reuse session + cookies (persistent profile).
- Avoid opening many tabs/windows.
- Avoid high request rates; prefer consistent, slow throughput.

## Phase 5: Write the Enriched CSV
Goal: produce a usable file for purchasing decisions.

1) Add new columns at the end of the CSV:
- `availability` (Available / Backorder / Not available / Unknown)
- Optional: `availability_note` (only populated when Unknown)
- Optional: `checked_at` timestamp
2) Write to:
- `outputs/pioneer-partslist-enriched-YYYYMMDD-HHMMSS.csv`

Incremental writes:
- Write updates every N rows (e.g., 50) or after each processed part to minimise data loss.

## QA Plan
- Validate the 3-state logic against known examples:
  - a clearly in-stock part (Available)
  - a Backorder part with Add to Cart (Backorder)
  - a Backorder part with NSP (Not available)
- Sample-check ~20 parts across categories.
- Confirm the run can be resumed without reprocessing already completed parts.

## Definition of Done
- The script can log in (including TOTP) and reach the dashboard.
- The parts list download completes and is saved to `outputs/`.
- The part search loop completes for a sample set (e.g., 200 parts) without triggering rate limiting.
- The enriched CSV contains `availability` populated using the agreed rules.
