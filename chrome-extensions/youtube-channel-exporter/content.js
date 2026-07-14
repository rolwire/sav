/*
 * YouTube Channel Exporter — content script
 *
 * Runs on youtube.com. Scans the video grid on a channel's "Videos" tab
 * (also works on a channel Home tab or search results), auto-scrolling to
 * load every video, then returns structured data for each one:
 *   { title, views, viewsText, published, duration, url, videoId, thumbnail }
 *
 * The popup drives it via chrome.runtime messages:
 *   { type: 'YCE_PING' }            -> { ok: true, context }
 *   { type: 'YCE_SCAN', options }   -> { ok: true, channel, videos } (async)
 * Progress is streamed back with { type: 'YCE_PROGRESS', ... } messages.
 */

(() => {
  if (window.__yceInjected) return;
  window.__yceInjected = true;

  const VIDEO_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-grid-video-renderer",
    "ytd-video-renderer",
  ].join(",");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Parse "1.2M views", "523K", "1,234 views", "No views" -> integer. */
  function parseViews(text) {
    if (!text) return null;
    const t = text.replace(/ /g, " ").trim();
    if (/^no views/i.test(t)) return 0;
    const m = t.match(/([\d.,]+)\s*([kmbKMB万億])?/);
    if (!m) return null;
    let num = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(num)) return null;
    const suffix = (m[2] || "").toLowerCase();
    const mult = { k: 1e3, m: 1e6, b: 1e9, 万: 1e4, 億: 1e8 }[suffix] || 1;
    return Math.round(num * mult);
  }

  function getVideoId(url) {
    if (!url) return null;
    try {
      const u = new URL(url, location.origin);
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return shorts[1];
    } catch (e) {
      /* ignore */
    }
    const m = url.match(/[?&]v=([^&]+)/) || url.match(/\/shorts\/([^/?]+)/);
    return m ? m[1] : null;
  }

  function firstText(el, selectors) {
    for (const sel of selectors) {
      const node = el.querySelector(sel);
      if (node) {
        const txt = (node.getAttribute("title") || node.textContent || "").trim();
        if (txt) return txt;
      }
    }
    return "";
  }

  /* Pull the two metadata items (views + published) out of a card. */
  function getMeta(card) {
    const items = card.querySelectorAll(
      "#metadata-line span.inline-metadata-item, #metadata-line .inline-metadata-item, #metadata-line span"
    );
    let viewsText = "";
    let published = "";
    for (const it of items) {
      const txt = (it.textContent || "").trim();
      if (!txt) continue;
      if (/view/i.test(txt) || /^[\d.,]+\s*[kmb]?$/i.test(txt)) {
        if (!viewsText) viewsText = txt;
      } else if (/ago|Streamed|Premiered|watching/i.test(txt)) {
        if (!published) published = txt;
      }
    }
    // Fallback: aria-label on the title link often reads
    // "TITLE by CHANNEL 1.2M views 3 days ago".
    if (!viewsText || !published) {
      const link = card.querySelector("a#video-title-link, a#video-title, #video-title");
      const aria = link && link.getAttribute("aria-label");
      if (aria) {
        const vm = aria.match(/([\d.,]+\s*[KMB]?)\s*views?/i);
        if (vm && !viewsText) viewsText = vm[0];
        const pm = aria.match(/(\d+\s+\w+\s+ago)/i);
        if (pm && !published) published = pm[1];
      }
    }
    return { viewsText, published };
  }

  function getDuration(card) {
    const sel = [
      "ytd-thumbnail-overlay-time-status-renderer #text",
      "#overlays #text",
      "#time-status #text",
      "badge-shape .badge-shape-wiz__text",
      ".badge-shape-wiz__text",
      "#time-status",
    ];
    for (const s of sel) {
      const n = card.querySelector(s);
      if (n) {
        const t = (n.textContent || "").trim();
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t;
      }
    }
    return "";
  }

  function extractCard(card) {
    const titleLink =
      card.querySelector("a#video-title-link") ||
      card.querySelector("a#video-title") ||
      card.querySelector("#video-title");
    if (!titleLink) return null;

    const title =
      (titleLink.getAttribute("title") ||
        titleLink.textContent ||
        "").replace(/\s+/g, " ").trim();
    if (!title) return null;

    const href =
      titleLink.getAttribute("href") ||
      (card.querySelector("a#thumbnail") || {}).getAttribute?.("href") ||
      "";
    const url = href ? new URL(href, location.origin).href : "";
    const videoId = getVideoId(url);
    const { viewsText, published } = getMeta(card);

    return {
      title,
      viewsText,
      views: parseViews(viewsText),
      published,
      duration: getDuration(card),
      url,
      videoId,
      thumbnail: videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : "",
    };
  }

  function detectChannelName() {
    const sel = [
      "ytd-channel-name#channel-name #text",
      "yt-dynamic-text-view-model h1",
      "#channel-header #text-container yt-formatted-string",
      "#channel-name #text",
      'meta[itemprop="name"]',
    ];
    for (const s of sel) {
      const n = document.querySelector(s);
      if (n) {
        const t = (n.getAttribute("content") || n.textContent || "").trim();
        if (t) return t;
      }
    }
    const t = document.title.replace(/\s*-\s*YouTube\s*$/, "").trim();
    return t || "youtube-channel";
  }

  function context() {
    const p = location.pathname;
    const onChannel =
      /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/.test(p);
    const onVideosTab = /\/videos\/?$/.test(p) || p.endsWith("/videos");
    return {
      onChannel,
      onVideosTab,
      onSearch: p === "/results",
      channelName: onChannel ? detectChannelName() : "",
      videoCount: document.querySelectorAll(VIDEO_SELECTOR).length,
    };
  }

  function progress(payload) {
    try {
      chrome.runtime.sendMessage({ type: "YCE_PROGRESS", ...payload });
    } catch (e) {
      /* popup may be closed */
    }
  }

  async function autoScroll(options) {
    const max = options.maxVideos || 0; // 0 = unlimited
    const maxIdle = 4; // stop after this many scrolls with no growth
    let idle = 0;
    let last = 0;

    for (let i = 0; i < 400; i++) {
      const cards = document.querySelectorAll(VIDEO_SELECTOR);
      const count = cards.length;
      progress({ phase: "scrolling", loaded: count });

      if (max && count >= max) break;
      if (count === last) {
        idle++;
        if (idle >= maxIdle) break;
      } else {
        idle = 0;
      }
      last = count;

      window.scrollTo(0, document.documentElement.scrollHeight);
      // Nudge the sentinel that triggers YouTube's lazy loader.
      const cont = document.querySelector("ytd-continuation-item-renderer");
      if (cont) cont.scrollIntoView();
      await sleep(options.scrollDelay || 700);
    }
    window.scrollTo(0, 0);
  }

  async function scan(options) {
    progress({ phase: "start" });
    if (options.autoScroll !== false) {
      await autoScroll(options);
    }

    const cards = document.querySelectorAll(VIDEO_SELECTOR);
    const seen = new Set();
    const videos = [];
    for (const card of cards) {
      const v = extractCard(card);
      if (!v) continue;
      const key = v.videoId || v.url || v.title;
      if (seen.has(key)) continue;
      seen.add(key);
      videos.push(v);
    }

    if (options.maxVideos && videos.length > options.maxVideos) {
      videos.length = options.maxVideos;
    }

    progress({ phase: "done", loaded: videos.length });
    return { channel: detectChannelName(), videos };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "YCE_PING") {
      sendResponse({ ok: true, context: context() });
      return; // sync
    }
    if (msg.type === "YCE_SCAN") {
      scan(msg.options || {})
        .then((data) => sendResponse({ ok: true, ...data }))
        .catch((err) =>
          sendResponse({ ok: false, error: String(err && err.message || err) })
        );
      return true; // keep channel open for async response
    }
  });
})();
