# YouTube Channel Exporter

A Chrome extension (Manifest V3) that collects **every video** from a YouTube
channel, sorts them by **highest views**, lets you **copy all titles**, grabs
each **thumbnail**, and **exports to Excel (`.xlsx`)** or CSV.

## What it does

1. Auto-scrolls the channel's **Videos** tab so YouTube lazy-loads all videos.
2. Scrapes for each video: **title, view count, upload date, video URL,
   thumbnail URL**.
3. Sorts by highest views (toggleable).
4. One-click:
   - **Copy titles** – all titles to your clipboard, newline-separated.
   - **Export .xlsx** – a real Excel workbook with clickable title links,
     numeric view counts, and thumbnail links.
   - **Export .csv** – UTF-8 (with BOM) so Excel opens it cleanly.

The `.xlsx` file is generated entirely in-browser (a small self-contained ZIP +
XLSX writer, no external libraries), so it works under Chrome's extension CSP.

## Install (Load unpacked)

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this
   `youtube-channel-exporter` folder.
4. Pin the extension from the puzzle-piece menu.

## Use

1. Open a channel and click its **Videos** tab
   (e.g. `https://www.youtube.com/@SomeChannel/videos`).
   > Tip: to start from YouTube's own popularity order, use the channel's
   > **Popular** sort — but the extension sorts by views itself regardless.
2. Click the extension icon → **Collect all videos**. It will scroll to the
   bottom to load everything (large channels take a bit).
3. Keep **Sort by highest views** checked (or uncheck to keep page order).
4. **Copy titles**, **Export .xlsx**, or **Export .csv**.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config, permissions, content-script registration |
| `content.js` | Runs on youtube.com; auto-scrolls + scrapes the video grid |
| `popup.html/.css/.js` | The toolbar UI, sorting, copy, and export logic |
| `lib/zip.js` | Minimal STORE-method ZIP writer with CRC32 |
| `lib/xlsx.js` | Builds a valid `.xlsx` workbook (inline strings + hyperlinks) |

## Notes & limits

- YouTube changes its DOM periodically; selectors in `content.js` are written
  defensively but may need updates if the layout changes.
- Thumbnails are exported as **URLs/links** (not embedded images) to keep the
  file small and reliable. Click a thumbnail link in Excel to open it.
- Very large channels (thousands of videos) can take a while to fully scroll.
