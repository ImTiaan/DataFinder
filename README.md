# DataFinder Scraper

A powerful tool to scrape product data from websites. This tool is designed to be easy to use, even if you have never written a line of code before.

## 🚀 Prerequisites (What you need first)

Before running the scraper, you need to install **Node.js**. This is the engine that runs the code.

### 🖥️ Windows Installation
1.  **Download Node.js:**
    *   Go to [nodejs.org](https://nodejs.org/).
    *   Download the **LTS (Long Term Support)** version (recommended for most users).
2.  **Install it:**
    *   Run the downloaded `.msi` file.
    *   Click "Next" through the setup wizard.
    *   **Important:** Make sure "Add to PATH" is selected (it usually is by default).
3.  **Verify Installation:**
    *   Press `Windows Key + R`, type `cmd`, and press Enter.
    *   In the black box, type: `node -v` and press Enter.
    *   You should see a version number (like `v20.x.x`).

### 🍎 Mac Installation
1.  **Download Node.js:**
    *   Go to [nodejs.org](https://nodejs.org/).
    *   Download the **LTS (Long Term Support)** version for macOS.
2.  **Install it:**
    *   Run the downloaded `.pkg` file and follow the instructions.
3.  **Verify Installation:**
    *   Open "Terminal" (Press `Command + Space`, type `Terminal`, and hit Enter).
    *   Type: `node -v` and press Enter.
    *   You should see a version number (like `v20.x.x`).

---

## 🛠️ Setup Guide

Once Node.js is installed, follow these steps to get the scraper running.

### 1. Download the Code
*   Click the green **Code** button on this page.
*   Select **Download ZIP**.
*   Extract the ZIP file to a folder on your computer (e.g., `Documents/DataFinder`).

### 2. Install Dependencies
This installs the extra tools the scraper needs (like the browser automation).

**Windows:**
1.  Open the folder where you extracted the files.
2.  Right-click an empty space in the folder and select **"Open in Terminal"** (or hold `Shift` + Right-click and choose "Open PowerShell window here").
3.  Type this command and press Enter:
    ```bash
    npm install
    ```
4.  After that finishes, install the browser engine by typing:
    ```bash
    npx playwright install
    ```

**Mac:**
1.  Open Terminal.
2.  Type `cd ` (with a space at the end) and drag the `DataFinder` folder into the terminal window. Press Enter.
3.  Type this command and press Enter:
    ```bash
    npm install
    ```
4.  After that finishes, install the browser engine by typing:
    ```bash
    npx playwright install
    ```

### 3. Configure Settings
1.  Find the file named `.env.example`.
2.  Rename it to just `.env` (remove the `.example`).
3.  Open `.env` with any text editor (Notepad, TextEdit, VS Code).
4.  Change the `TARGET_URL` to the website you want to scrape.
5.  Save the file.

---

## ▶️ How to Run

To start the scraper, make sure your terminal (or PowerShell) is still open in the folder, and run:

```bash
npm run scrape
```

*   **What happens next?**
    *   The scraper will start up.
    *   It will visit the site and start collecting data.
    *   You will see progress bars in the terminal.
    *   When finished, a new CSV file will appear in the `outputs/` folder containing all the data.

---

## ❓ Troubleshooting

*   **"command not found"**: This usually means Node.js wasn't installed correctly. Try restarting your computer.
*   **Scraper stops early**: Check your internet connection. The scraper saves progress as it goes, so you can restart it without losing everything.

---

## 📜 Licence

This project is licensed under the terms of the MIT Licence. See the [LICENCE](LICENCE) file for details.
