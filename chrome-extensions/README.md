# YouTube Creator Toolkit — Chrome Extensions

Two standalone, dependency-free Chrome extensions (Manifest V3) for YouTube
creator/topic research:

| Extension | What it does |
|---|---|
| [**YouTube Channel Exporter**](./youtube-channel-exporter) | Open any channel, scan every video, sort by views, copy all titles, and export titles + views + thumbnails to a real `.xlsx` (or `.csv`). |
| [**YouTube New-Channels Sorter**](./youtube-new-channels-sorter) | Search a topic on YouTube and re-sort the results to surface videos from **new / small / fast-growing** channels, with subscriber count and channel age shown on each result. |

Both are pure HTML/CSS/JS with **no external libraries and no network calls to
third-party servers** — everything runs locally in your browser. The Excel
export uses a hand-rolled Office Open XML writer bundled in the extension.

## Install (Load unpacked)

Neither extension is on the Chrome Web Store; load them in developer mode:

1. Open **`chrome://extensions`** in Chrome (or any Chromium browser — Edge, Brave, Arc, Opera).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the extension folder you want:
   - `chrome-extensions/youtube-channel-exporter`
   - `chrome-extensions/youtube-new-channels-sorter`
5. Repeat step 3–4 for the second folder.
6. Pin them from the puzzle-piece menu for one-click access.

> If you already had a YouTube tab open before installing, **reload the tab**
> so the extension's content script is injected.

## Quick start

- **Channel Exporter** → open a channel's **Videos** tab → click the toolbar
  icon → **Scan channel** → **Export .xlsx**.
- **New-Channels Sorter** → **search a topic** on YouTube → click the toolbar
  icon → **Analyze & sort this search**.

See each extension's own README for details, options and how it works.

## Notes & limitations

- YouTube renders its UI dynamically and occasionally changes its internal
  markup. The extensions use several fallback selectors, but a major YouTube
  redesign could require an update.
- View counts on YouTube are shown rounded (e.g. "1.2M"), so exported numbers
  are YouTube's rounded values, not exact counts.
- The New-Channels Sorter reads each channel's public "About" page to get
  subscriber count and join date; channels that hide their subscriber count
  will show `?`.
- These tools scrape the pages you are viewing. They don't use the YouTube Data
  API, need no API key, and send nothing to any server.
