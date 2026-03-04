# Plan: Browser-based scraping via tools, no separate app

Great—this is doable without building a separate app. I can drive a real browser to log in (including 2FA), navigate, query data for large lists of components, and export results on demand. Here’s how we’ll set it up and run it using tools only, with no standalone application.

## What I need from you to start
- The target website URL
- Your login username and password (we’ll handle them securely; see below)
- The type of 2FA the site uses:
  - TOTP (app-generated 6-digit codes like Google Authenticator)
  - SMS/email one-time code
  - Security key/push approval
- The exact fields you want for each component (examples: SKU/part number, description, stock/availability, price, MOQ, lead time, packaging, last-updated timestamp)
- How you want to provide the list of components:
  - A CSV of SKUs/part numbers in this folder
  - Pull all components visible in a category/listing
  - A set of search filters or URLs we should iterate through

## How I’ll do it (no separate app)
- I’ll use a real browser session under the hood to:
  - Navigate to the site
  - Fill username/password
  - Handle 2FA
  - Persist session cookies locally to avoid repeating 2FA when possible
  - Traverse pages, search or open detail pages, and extract the fields you need
- I’ll store outputs directly in your current workspace:
  - CSV exports for quick review
  - Optionally a local SQLite database for fast lookups and incremental updates
- When you say “update now”, I’ll:
  - Reuse the saved session to skip 2FA (if still valid)
  - Refresh only the SKUs or pages you care about
  - Append or replace outputs (your choice), and report a summary of changes

## 2FA handling options
- **TOTP-based 2FA:**
  - If you can provide the TOTP secret key securely (not in code or files—we’ll use an environment variable), I’ll generate the 6-digit codes automatically during login.
- **SMS/email code:**
  - I’ll pause at the code prompt, and you’ll paste the one-time code when requested. We’ll then persist the session so subsequent runs likely won’t need 2FA again.
- **Security key/push:**
  - I’ll pause for you to complete the device approval, then continue and persist the session.

## Session persistence and security
- I’ll store only the minimum needed session data (cookies/local storage) in a local file in this folder.
- No secrets or credentials will be committed to any repository—use environment variables for username/password/TOTP secret.
- If the site invalidates the session, we’ll re-login and re-verify 2FA.

## Scaling to tens of thousands of components
- I’ll implement batching, polite rate limits, and randomized delays to reduce the risk of being blocked.
- If the site supports pagination or search filters, I’ll page through results and collect details efficiently.
- If it only exposes detail pages per SKU, I’ll iterate through your SKU list with backoff and retries.
- If the site introduces CAPTCHAs, I’ll pause so you can solve them, then resume.

## Data storage and updates
- **CSV:** Easy to view and share. I’ll include all fields you request plus timestamps.
- **SQLite (optional):** Enables fast incremental updates, diffing, and selective refresh. Useful when you often recheck tens of thousands of items.
- **Incremental updates:**
  - Compare new scrape vs prior results
  - Only update changed entries (e.g., stock or price changes)
  - Generate a short report of changes

## Compliance
- I’ll be mindful of the website’s terms and usage constraints, throttle requests, and avoid disruptive patterns. If the site provides an export or API, we can prefer that route.

## What would you like me to do next?
- Share the site URL and the login/2FA details (type of 2FA), plus the fields you want to extract.
- Tell me how you want to provide the component list (CSV of SKUs in this folder, or instructions to enumerate pages).
- Confirm whether you want CSV only or CSV + SQLite.

Once I have those, I’ll:
- Log in and persist the session
- Scrape a small batch to validate fields and format
- Scale up to the full list with rate-limiting
- Produce the first export and set up on-demand refresh so you can ask for updates anytime

## Usage (current tooling)
- Install dependencies:
  - From this folder: `npm install`
- Optional environment setup:
  - Copy `.env.example` to `.env` and fill values:
    - LOGIN_URL, TARGET_URL, SELECTOR, USERNAME, PASSWORD, TOTP_SECRET, HEADLESS, BROWSER_PROFILE_DIR, OUTPUT_DIR
- Run an interactive login and scrape:
  - With CLI args: `npm run scrape -- --loginUrl <LOGIN_URL> --url <TARGET_URL> --selector <CSS_SELECTOR>`
  - Or with `.env`: `npm run scrape` (HEADLESS can be set to `true` for headless mode)
  - Complete login and any 2FA in the opened browser, then press Enter in the terminal to continue.
- Outputs:
  - CSV saved under `outputs/` with a timestamped filename.
- Code references:
  - [package.json](file:///Users/t333btc/Documents/Test%20Scraper/package.json)
  - [scrape.mjs](file:///Users/t333btc/Documents/Test%20Scraper/scrape.mjs)

## Full-site scraping via sitemap (e.g., thepihut.com)
- Configure `.env`:
  - `TARGET_URL=https://thepihut.com`
  - `CRAWL_SITEMAP=true`
  - `HEADLESS=true` (recommended)
  - Optional: `MAX_PRODUCTS=0` for all, or a number to limit
- Run:
  - `npm run scrape`
- Output:
  - CSV saved under `outputs/` with columns: `name,sku,price,availability`
