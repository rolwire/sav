/*
 * YouTube New-Channels Sorter — content script
 *
 * On a YouTube search page (/results?search_query=...) it:
 *   1. Collects every video result and its channel.
 *   2. Fetches each unique channel page (same-origin) to read subscriber
 *      count and join date from ytInitialData.
 *   3. Annotates each result with a badge (subs · age · NEW) and re-sorts the
 *      list so new / small / fast-growing channels rise to the top.
 *
 * Reordering uses CSS flex `order` on the results container rather than moving
 * DOM nodes, so it survives YouTube's virtualization and is trivial to reset.
 */

(() => {
  if (window.__yncsInjected) return;
  window.__yncsInjected = true;

  const CACHE = new Map(); // channelUrl -> meta
  const state = { applied: false, mode: null, options: null, parents: new Set() };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const onSearch = () => location.pathname === "/results";

  // ---------- number / text helpers ----------
  function parseCount(text) {
    if (!text) return null;
    const t = String(text);
    if (/^no\b/i.test(t)) return 0;
    const m = t.match(/([\d.,]+)\s*([KMBkmb])?/);
    if (!m) return null;
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(num)) return null;
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] || 1;
    return Math.round(num * mult);
  }
  function fmt(n) {
    if (n == null || isNaN(n)) return "?";
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }
  function ageLabel(date) {
    if (!date) return "";
    const days = (Date.now() - date.getTime()) / 86400000;
    if (days < 31) return Math.max(1, Math.round(days)) + "d";
    if (days < 365) return Math.round(days / 30) + "mo";
    const y = days / 365;
    return (y < 10 ? y.toFixed(1).replace(/\.0$/, "") : Math.round(y)) + "y";
  }

  // ---------- robust ytInitialData extraction ----------
  function extractJson(html, marker) {
    let i = html.indexOf(marker);
    if (i < 0) return null;
    i = html.indexOf("{", i);
    if (i < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        if (--depth === 0) {
          try { return JSON.parse(html.slice(i, j + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  function deepFind(obj, key, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 30) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    for (const k in obj) {
      const v = obj[k];
      if (v && typeof v === "object") {
        const r = deepFind(v, key, depth + 1);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  function textOf(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v.simpleText) return v.simpleText;
    if (typeof v.content === "string") return v.content;
    if (v.content) return textOf(v.content);
    if (Array.isArray(v.runs)) return v.runs.map((r) => r.text).join("");
    return "";
  }

  function aboutUrl(channelUrl) {
    try {
      const u = new URL(channelUrl, location.origin);
      let p = u.pathname.replace(/\/(videos|featured|about|shorts|streams|playlists|community)\/?$/, "");
      return u.origin + p.replace(/\/$/, "") + "/about";
    } catch (e) {
      return channelUrl + "/about";
    }
  }

  async function fetchChannelMeta(channelUrl) {
    if (CACHE.has(channelUrl)) return CACHE.get(channelUrl);
    const sessionKey = "yncs:" + channelUrl;
    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        const m = JSON.parse(cached);
        if (m.joined) m.joinedDate = new Date(m.joined);
        CACHE.set(channelUrl, m);
        return m;
      }
    } catch (e) { /* ignore */ }

    let meta = { subs: null, subsText: "", joinedDate: null, joinedText: "", videos: null, error: false };
    try {
      const res = await fetch(aboutUrl(channelUrl), { credentials: "include" });
      const html = await res.text();
      const data = extractJson(html, "ytInitialData");

      let subsText = "", joinedText = "", videosText = "";
      const about = deepFind(data, "aboutChannelViewModel");
      if (about) {
        subsText = textOf(about.subscriberCountText);
        joinedText = textOf(about.joinedDateText);
        videosText = textOf(about.videoCountText);
      }
      subsText = subsText || textOf(deepFind(data, "subscriberCountText"));
      videosText = videosText || textOf(deepFind(data, "videosCountText")) || textOf(deepFind(data, "videoCountText"));

      // Join date can live under different keys / free text.
      if (!joinedText) {
        const jd = deepFind(data, "joinedDateText");
        joinedText = textOf(jd);
      }
      if (!joinedText && data) {
        const hay = JSON.stringify(data);
        const jm = hay.match(/Joined\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4})/);
        if (jm) joinedText = "Joined " + jm[1];
      }

      meta.subsText = subsText;
      meta.subs = parseCount(subsText.replace(/subscribers?/i, ""));
      meta.videos = parseCount(videosText);
      meta.joinedText = joinedText;
      if (joinedText) {
        const d = new Date(joinedText.replace(/^Joined\s+/i, ""));
        if (!isNaN(d.getTime())) meta.joinedDate = d;
      }
    } catch (e) {
      meta.error = true;
    }

    CACHE.set(channelUrl, meta);
    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ ...meta, joined: meta.joinedDate ? meta.joinedDate.toISOString() : null })
      );
    } catch (e) { /* quota */ }
    return meta;
  }

  // ---------- scanning the results page ----------
  function scanResults() {
    const cards = Array.from(document.querySelectorAll("ytd-video-renderer"));
    const items = [];
    for (const card of cards) {
      const titleEl = card.querySelector("#video-title");
      if (!titleEl) continue;
      const chLink = card.querySelector("ytd-channel-name a, #channel-name a, .ytd-channel-name a");
      const channelUrl = chLink ? new URL(chLink.getAttribute("href"), location.origin).href : "";
      const channelName = chLink ? chLink.textContent.trim() : "";

      // views + published from the metadata line
      let views = null, published = "";
      const metaSpans = card.querySelectorAll("#metadata-line span.inline-metadata-item, #metadata-line span");
      metaSpans.forEach((s) => {
        const t = s.textContent.trim();
        if (/view/i.test(t) && views == null) views = parseCount(t.replace(/views?/i, ""));
        else if (/ago|Streamed|Premiered/i.test(t) && !published) published = t;
      });

      items.push({
        card,
        title: (titleEl.getAttribute("title") || titleEl.textContent || "").trim(),
        channelName,
        channelUrl,
        views,
        published,
      });
    }
    return items;
  }

  // ---------- badges ----------
  function badgeFor(item, opts) {
    const meta = item.meta || {};
    const isNewAge =
      meta.joinedDate &&
      (Date.now() - meta.joinedDate.getTime()) / 86400000 <= (opts.maxAgeDays || Infinity);
    const isSmall = meta.subs != null && meta.subs <= (opts.maxSubs || Infinity);
    item.isNew = !!(isNewAge || isSmall);

    const parts = [];
    parts.push(`<span class="yncs-sub">👤 ${meta.subs == null ? "?" : fmt(meta.subs)}</span>`);
    if (meta.joinedDate) parts.push(`<span class="yncs-age">🗓 ${ageLabel(meta.joinedDate)}</span>`);
    if (item.views != null && meta.subs) {
      const ratio = item.views / Math.max(meta.subs, 1);
      if (ratio >= 1) parts.push(`<span class="yncs-fire">🔥 ${ratio.toFixed(ratio >= 10 ? 0 : 1)}× subs</span>`);
    }
    if (isNewAge) parts.push(`<span class="yncs-new">NEW</span>`);
    else if (isSmall) parts.push(`<span class="yncs-small">SMALL</span>`);
    if (meta.error) parts.push(`<span class="yncs-err">channel n/a</span>`);

    let badge = item.card.querySelector(".yncs-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "yncs-badge";
      const meta_line = item.card.querySelector("#metadata-line") || item.card.querySelector("#meta");
      if (meta_line && meta_line.parentElement) meta_line.parentElement.insertBefore(badge, meta_line.nextSibling);
      else item.card.appendChild(badge);
    }
    badge.innerHTML = parts.join("");
    item.card.classList.toggle("yncs-highlight", item.isNew);
  }

  // ---------- scoring & ordering ----------
  function score(item, mode) {
    const m = item.meta || {};
    if (mode === "newest") {
      return m.joinedDate ? -m.joinedDate.getTime() : Infinity; // ascending; newest (largest time) first
    }
    if (mode === "fewest_subs") {
      return m.subs == null ? Infinity : m.subs; // ascending
    }
    // opportunity: high views relative to a small, young channel
    const subs = m.subs == null ? 1e9 : Math.max(m.subs, 100);
    const views = item.views || 0;
    let s = views / subs; // views-per-subscriber
    if (m.joinedDate) {
      const yrs = Math.max(0.1, (Date.now() - m.joinedDate.getTime()) / (365 * 86400000));
      s *= 1 + 1 / yrs; // younger channels get a boost
    }
    return -s; // ascending sort => highest score first
  }

  function applyOrder(items, opts) {
    // Group cards by their container so we only reorder siblings.
    const groups = new Map();
    for (const it of items) {
      const parent = it.card.parentElement;
      if (!parent) continue;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(it);
    }
    for (const [parent, group] of groups) {
      parent.style.display = "flex";
      parent.style.flexDirection = "column";
      state.parents.add(parent);
      const ranked = group.slice().sort((a, b) => score(a, opts.mode) - score(b, opts.mode));
      ranked.forEach((it, i) => {
        it.card.style.order = String(i);
        if (opts.hideOthers && !it.isNew) it.card.style.display = "none";
        else it.card.style.display = "";
      });
      // Keep every non-video sibling (shelves, continuation sentinel) after the sorted videos.
      Array.from(parent.children).forEach((child) => {
        if (child.tagName !== "YTD-VIDEO-RENDERER" && child.style) child.style.order = "9999";
      });
    }
  }

  function resetOrder() {
    document.querySelectorAll("ytd-video-renderer").forEach((c) => {
      c.style.order = "";
      c.style.display = "";
      c.classList.remove("yncs-highlight");
      const b = c.querySelector(".yncs-badge");
      if (b) b.remove();
    });
    state.parents.forEach((el) => {
      if (el) { el.style.display = ""; el.style.flexDirection = ""; }
    });
    state.parents.clear();
    state.applied = false;
  }

  // ---------- concurrency-limited fetch ----------
  async function fetchAll(items, onProgress) {
    const unique = new Map();
    for (const it of items) {
      if (it.channelUrl && !unique.has(it.channelUrl)) unique.set(it.channelUrl, []);
      if (it.channelUrl) unique.get(it.channelUrl).push(it);
    }
    const urls = Array.from(unique.keys());
    let done = 0;
    const CONCURRENCY = 4;
    let idx = 0;
    async function worker() {
      while (idx < urls.length) {
        const url = urls[idx++];
        const meta = await fetchChannelMeta(url);
        unique.get(url).forEach((it) => (it.meta = meta));
        done++;
        onProgress && onProgress(done, urls.length);
        await sleep(60);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  }

  function progress(payload) {
    try { chrome.runtime.sendMessage({ type: "YNCS_PROGRESS", ...payload }); } catch (e) {}
  }

  async function analyze(options) {
    if (!onSearch()) return { ok: false, error: "Not a YouTube search page. Search for a topic first." };
    const items = scanResults();
    if (!items.length) return { ok: false, error: "No video results found on this page." };

    progress({ phase: "fetching", done: 0, total: 0 });
    await fetchAll(items, (done, total) => progress({ phase: "fetching", done, total }));

    items.forEach((it) => badgeFor(it, options));
    applyOrder(items, options);
    state.applied = true;
    state.options = options;

    const withMeta = items.filter((it) => it.meta && it.meta.subs != null);
    const newCount = items.filter((it) => it.isNew).length;
    return {
      ok: true,
      total: items.length,
      channels: new Set(items.map((i) => i.channelUrl)).size,
      resolved: withMeta.length,
      newCount,
    };
  }

  // ---------- messaging ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "YNCS_PING") {
      sendResponse({ ok: true, onSearch: onSearch(), applied: state.applied,
        query: new URLSearchParams(location.search).get("search_query") || "" });
      return;
    }
    if (msg.type === "YNCS_ANALYZE") {
      analyze(msg.options || {}).then(sendResponse).catch((e) =>
        sendResponse({ ok: false, error: String(e && e.message || e) }));
      return true;
    }
    if (msg.type === "YNCS_RESET") {
      resetOrder();
      sendResponse({ ok: true });
      return;
    }
  });

  // Re-apply after in-app navigation to a new search, if the user left it on.
  window.addEventListener("yt-navigate-finish", () => {
    if (state.applied && onSearch() && state.options) {
      setTimeout(() => analyze(state.options), 800);
    }
  });
})();
