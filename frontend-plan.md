# Plan: Vercel-Hosted Frontend with Vercel Blob Storage

This plan outlines how to wrap your existing Node.js scraper into a web application hosted on Vercel, using **Vercel Blob** for storage and **GitHub Actions** for the heavy lifting.

## 1. Architecture Overview

Since Vercel functions time out after 10-60 seconds, we cannot run the scraper directly on the Vercel web server.

**The Solution:**
1.  **Frontend (Next.js on Vercel):**
    *   Protected by a login page.
    *   Lists CSV files stored in **Vercel Blob**.
    *   Has a "Start Scrape" button that triggers the GitHub Action.
2.  **Scraper Worker (GitHub Actions):**
    *   Runs the `scrape.mjs` script.
    *   Uploads the resulting CSV directly to **Vercel Blob** using the `@vercel/blob` SDK.
3.  **Storage (Vercel Blob):**
    *   Stores the CSV files.
    *   Provides secure download URLs.

---

## 2. Technology Stack

*   **Frontend Framework:** Next.js (React) - Easy to deploy on Vercel.
*   **Authentication:** NextAuth.js (Auth.js) - Simple password protection.
*   **Storage:** **Vercel Blob** (Simple, native integration).
*   **Worker:** GitHub Actions (Free runner).

---

## 3. Step-by-Step Implementation Plan

### Phase 1: Vercel Blob Setup
1.  **Install SDK:** We need to add `@vercel/blob` to your project.
2.  **Modify Scraper:** Update `scrape.mjs` to:
    *   Import `put` from `@vercel/blob`.
    *   After the CSV is generated, upload it to Vercel Blob.
    *   Log the download URL.

### Phase 2: GitHub Actions (The Worker)
1.  Create `.github/workflows/scrape.yml`.
2.  Configure it to run `npm run scrape`.
3.  **Secrets:** We will need to add `BLOB_READ_WRITE_TOKEN` to your GitHub repository secrets (you get this token from Vercel).

### Phase 3: The Frontend (Next.js)
1.  **Initialize Next.js App:** Create a `web/` folder.
2.  **Login Page:** Simple password protection.
3.  **Dashboard:**
    *   **List Files:** Use `list()` from `@vercel/blob` to show available CSVs.
    *   **Download:** Provide links to the files.
    *   **Trigger Scrape:** A button that calls the GitHub API (`POST /repos/{owner}/{repo}/dispatches`) to start the workflow.

---

## 4. Development Roadmap

1.  **Update Scraper:** Add Vercel Blob upload logic to `scrape.mjs`.
2.  **Create GitHub Action:** Set up the workflow file.
3.  **Build Frontend:** Create the Next.js app in a `web/` subdirectory.
4.  **Deploy:** Connect to Vercel.

---

## 5. Prerequisite for You
*   You will need a **Vercel Account**.
*   You will need to create a new "Storage" (Blob) project in your Vercel dashboard to get the `BLOB_READ_WRITE_TOKEN`.

*Let me know if you want to proceed with **Step 1: Updating the scraper code**.*
