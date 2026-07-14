# YouTube Channel Exporter

Open any YouTube channel, scan **every** video, and get the titles, view
counts and thumbnails out — sorted by views and exported to Excel.

![icon](icons/icon128.png)

## Features

- **Scan a whole channel** — auto-scrolls the Videos tab to load every video (not just the first screen).
- **Sort by views** — high → low (default), low → high, channel order, or title A→Z.
- **Copy all titles** — one click copies every title (in the current sort order) to your clipboard.
- **Export to Excel** — a genuine `.xlsx` file with columns:
  `# · Title · Views · Views (shown) · Published · Duration · Video link · Thumbnail link`.
  Views are stored as real numbers so you can re-sort/filter in Excel. Header row
  is frozen and an auto-filter is applied.
- **Export to CSV** — UTF-8 with BOM, opens cleanly in Excel/Sheets.
- **Thumbnails** — each row links to the video's `hqdefault.jpg` thumbnail; a live preview grid is shown in the popup.

## How to use

1. Go to a channel and open its **Videos** tab
   (e.g. `youtube.com/@SomeChannel/videos`).
2. Click the **Channel Exporter** toolbar icon.
3. (Optional) choose a **sort order** and a **max videos** cap (`0` = all).
4. Click **Scan channel** and wait while it scrolls and collects everything.
5. Click **Copy all titles**, **Export .xlsx**, or **Export .csv**.

Files are named like `some-channel-videos-2026-07-14.xlsx`.

## How it works

- `content.js` runs on `youtube.com`. It collects each video card
  (`ytd-rich-item-renderer` / `ytd-grid-video-renderer`), reads the title, the
  view/date metadata line and the duration overlay, and derives the thumbnail
  URL from the video ID. It auto-scrolls until no new videos load.
- `xlsx.js` is a tiny, self-contained **XLSX writer**: it builds the Office Open
  XML parts and packs them into a ZIP (STORE method + CRC32) entirely in
  JavaScript, so a real `.xlsx` is produced without any external library —
  important because extension pages can't load scripts from a CDN.
- `popup.js` drives the UI, applies the chosen sort, and triggers the download.

## Permissions

- `activeTab`, `scripting` — to read and (if needed) inject the collector into the current YouTube tab.
- `downloads` — declared for saving exports.
- `host_permissions: youtube.com` — the extension only runs on YouTube.

No data leaves your browser.

## Notes

- View counts are YouTube's rounded display values (e.g. `1.2M`). The numeric
  `Views` column uses the parsed rounded number; `Views (shown)` keeps the exact
  label YouTube displayed.
- Very large channels (thousands of videos) take a while to fully scroll; use
  the **Max videos** cap for a quick top-N export.
