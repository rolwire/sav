# YouTube New-Channels Sorter

A Chrome extension (Manifest V3) that re-sorts your **YouTube search results**
to surface videos from **newer / smaller channels** first — so a topic search
isn't dominated by the same big channels.

## What it does

When you search a topic on YouTube, a floating panel appears (top-right). It
re-orders the results using:

- **New & small (balanced)** – blends upload recency and view count.
- **Newest uploads first** – most recently uploaded videos on top.
- **Smallest channels first** – lowest view counts on top.

Plus **One video per channel** to dedupe, so you discover as many *distinct*
channels for the topic as possible.

Every result also gets a small badge (e.g. `🕓 12d · 👁 800`) showing the
recency and views used to rank it, and turns green for fresh uploads / blue for
low-view videos.

### How "new channel" is estimated

YouTube's search page does **not** expose a channel's creation date or
subscriber count. This extension uses the two strongest signals that *are* on
the page as proxies:

- **Upload recency** — a fresher upload suggests an active/newer channel.
- **View count** — fewer views suggests a smaller/newer channel.

These are heuristics, not exact channel ages. The per-result badge shows the
values used so the ranking is transparent. (An exact-age version would require
the YouTube Data API and a key — out of scope for a zero-config extension.)

## Install (Load unpacked)

1. Go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `youtube-newchannels-sort` folder.

## Use

1. Search any topic on YouTube.
2. Use the **New-Channel Sort** panel (top-right) to pick a mode and toggle
   dedupe. Settings persist and re-apply as you scroll and search again.
3. Click the panel header to collapse/expand it.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config; runs only on `youtube.com/results*` |
| `content.js` | Parses, scores, re-orders results; builds the control panel |
| `styles.css` | Panel and badge styling |

## Notes & limits

- Re-sorting operates within YouTube's results list and re-applies on infinite
  scroll and in-app navigation (SPA-aware).
- Selectors may need updates if YouTube changes its search DOM.
- Ranking quality depends on the proxy signals above; it is not a substitute
  for true subscriber/age data.
