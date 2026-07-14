# Chrome Extensions

Two standalone Chrome extensions (Manifest V3). Each folder loads independently
via **`chrome://extensions` → Developer mode → Load unpacked**.

## 1. [`youtube-channel-exporter/`](./youtube-channel-exporter)

Open a YouTube channel's **Videos** tab and collect every video: titles, view
counts, upload dates, and thumbnails. Sort by highest views, copy all titles,
and **export to Excel (`.xlsx`)** or CSV — the `.xlsx` is built in-browser with
no external libraries.

## 2. [`youtube-newchannels-sort/`](./youtube-newchannels-sort)

Search a topic on YouTube and re-sort the results to surface videos from
**newer / smaller channels** first (with an optional one-video-per-channel mode
for discovering new creators). Uses upload recency and view count as proxies for
channel age/size, with a transparent badge on each result.

---

Both are self-contained, dependency-free, and respect Chrome's extension
Content-Security-Policy. See each folder's README for install and usage details.
