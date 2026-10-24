# Katha Studio

**Professional screenwriting for Indian film and OTT writers** — industry-standard
screenplay formatting with Tamil, Telugu, Hindi, Malayalam and Kannada built in,
South Indian commercial-cinema tools (songs, interval, fight blocks, pulse chart),
production reports and an optional AI assistant.

- 🌐 **Use it in your browser:** https://adijustadi01.github.io/katha-studio/
- 💻 **Windows app (.exe installer):** https://github.com/adijustadi01/katha-studio/releases/latest

Your scripts stay on your computer. No accounts, no server, no analytics.

---

## Install the Windows desktop app

1. Open the **[latest release](https://github.com/adijustadi01/katha-studio/releases/latest)**.
2. Under **Assets**, click **`Katha-Studio-Setup-x.y.z.exe`** to download it.
3. Double-click the downloaded file.
4. **If Windows shows "Windows protected your PC"** (blue SmartScreen box): this
   appears for new apps that are not yet code-signed. Click **More info**, check
   that the app name is *Katha-Studio-Setup…*, then click **Run anyway**.
   (Your browser may also say the file "isn't commonly downloaded" — choose
   **Keep** / **Keep anyway**.)
5. Follow the installer (you can choose the install folder). A **Katha Studio**
   shortcut appears on the desktop and in the Start menu.
6. Double-clicking any `.katha` file now opens it in Katha Studio. Final Draft
   (`.fdx`), Fountain and Word files open via **File → Open**.

The app checks GitHub Releases for updates and offers to restart when a new
version has downloaded. Backups are kept in **Documents\Katha Studio Backups**
(the last 50 versions plus one per day).

## Install the web app (PWA) from Chrome or Edge

1. Open https://adijustadi01.github.io/katha-studio/ in **Google Chrome** or **Microsoft Edge**.
2. Click the **install icon** at the right end of the address bar (a monitor with a
   down-arrow), or open the ⋮ menu → **Cast, save and share → Install page as app…**
   (Edge: ⋯ → **Apps → Install this site as an app**).
3. Click **Install**. Katha Studio opens in its own window and works **offline**.

Tips for the browser version: press **Ctrl+S** once to pick a real file on your
disk (Chrome/Edge then keep that file updated), and use the **⬇ Backup** button
regularly — browser storage can be wiped if you clear your browsing data.

## Turn on the AI assistant (optional)

1. Create an API key at https://console.anthropic.com → **API keys** (needs an Anthropic account with credit).
2. In Katha Studio open **Tools → Settings → AI** (or click **✨ AI** in the toolbar → *Add API key*).
3. Paste the key and click **Save key**. It is stored only on this device (encrypted with your Windows account in the desktop app).
4. In the **✨ AI** panel choose an action and click **Preview what will be sent…**. You see the exact text first; nothing is sent until you click **Send**. Rewrites come back as a side-by-side review — **Accept** or **Reject**.

The model can be changed in Settings → AI (default `claude-opus-5-5`).

## Release a new version (for maintainers)

1. Change `"version"` in `package.json` (e.g. `1.0.1`) and commit it to `main`.
2. Create and push a matching tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. The **Release Windows installer** workflow builds the NSIS installer on a
   Windows runner and publishes it to **GitHub Releases** with `latest.yml`, which
   installed apps use to auto-update. (The tag must match `package.json`, or the
   workflow stops.)
4. Every push to `main` also rebuilds and redeploys the web app to GitHub Pages
   (the installed PWA updates itself and asks to reload).

You can also run the release workflow manually from the **Actions** tab to get a
test installer as a workflow artifact without publishing a release.

## Features at a glance

- **Editor:** all standard elements + Song, Interval, Fight Block, Montage/Flashback markers; smart Enter/Tab flow; Ctrl+1–9; SmartType; automatic (CONT'D); dual dialogue; scene numbers; bookmarks; find & replace with element filters; unlimited undo; spell check; Page / Draft / Speed views, focus mode, typewriter scrolling, zoom, dark theme.
- **Formatting:** Indian Standard (A4, default), Hollywood (US Letter), TV one-hour, TV half-hour multicam, stage play; editable templates; exact pagination with (MORE)/(CONT'D) at sentence boundaries, keep-with-next rules, optional CONTINUED headers; runtime and First/Second-half timing.
- **Indian languages:** live phonetic typing for Tamil, Telugu, Hindi, Malayalam, Kannada with suggestions and a learning dictionary; convert tools; bilingual dialogue (native + Roman + English meaning); Chromium-rendered PDFs with correct shaping; English / Tamil / Telugu interface.
- **Story:** navigator, index cards, beat board, outline with acts, story tracks timeline, characters and locations databases, notes.
- **Commercial cinema:** song and fight details, interval halves, scene tags, Pulse Chart scorecard, punch-dialogue library.
- **Production:** breakdown tagging, breakdown sheets, scene/character/cast/location/day-night/INT-EXT/songs/fights/tag reports, one-liner (PDF + Excel), stripboard with day-wise schedule.
- **Revisions:** industry colour revisions with asterisks, locked pages (A-pages) and scene numbers (12A), omitted scenes, automatic snapshots + named drafts, side-by-side compare, watermarked PDFs.
- **Files:** `.katha` project (zip: script + images + history); import/export Final Draft `.fdx` and Fountain (round-trip tested), Word `.docx`, plain text; export PDF and HTML.
- **Safety:** autosave, recovery copies, rolling + daily backups, crash recovery, unsaved-work warnings.
- **Writing aids:** goals and streaks, sprint timer, session stats, read aloud with per-character voices, customizable shortcuts, illustrated manual and tutorial.

## Develop

```bash
npm install
npm run dev          # web app at http://localhost:5173/katha-studio/
npm test             # unit tests (formatting, pagination, import/export round trips, transliteration…)
npm run typecheck
npm run build        # production PWA in dist/
npm run electron     # build and launch the desktop app
npm run dist:win     # Windows installer into release/ (on Windows)
```

Browser checks used during development live in `scripts/e2e-*.cjs` (Playwright).

See [CREDITS.md](CREDITS.md) for fonts and libraries. Licensed under the MIT License.
