/* YouTube Channel Exporter — content script
 * Runs inside youtube.com pages. Auto-scrolls a channel's Videos grid to
 * force lazy-loading of every video, then scrapes title / views / date /
 * thumbnail / url for each one. Communicates with the popup via messages.
 */

(() => {
  if (window.__ytChannelExporterLoaded) return;
  window.__ytChannelExporterLoaded = true;

  // "1.2M views" / "12K views" / "1,234 views" / "No views" -> integer
  function parseViews(text) {
    if (!text) return 0;
    const t = text.toLowerCase().replace(/views?/, "").replace(/,/g, "").trim();
    const m = t.match(/([\d.]+)\s*([kmb])?/);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    const unit = m[2];
    if (unit === "k") n *= 1e3;
    else if (unit === "m") n *= 1e6;
    else if (unit === "b") n *= 1e9;
    return Math.round(n);
  }

  function itemNodes() {
    return document.querySelectorAll(
      "ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer"
    );
  }

  // Scroll until the video count stops growing (or we hit safety limits).
  async function autoScroll(onProgress) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let stable = 0;
    let last = 0;
    const maxLoops = 400; // hard safety cap
    for (let i = 0; i < maxLoops; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(650);
      const count = itemNodes().length;
      onProgress && onProgress(count);
      if (count === last) {
        stable++;
        if (stable >= 4) break; // no growth across several tries -> done
      } else {
        stable = 0;
        last = count;
      }
    }
    window.scrollTo(0, 0);
    await sleep(200);
  }

  function bestThumb(node) {
    const img = node.querySelector(
      "ytd-thumbnail img, #thumbnail img, img.yt-core-image, img"
    );
    if (!img) return "";
    // Lazy images sometimes keep the real url only after they enter viewport.
    let src = img.getAttribute("src") || img.getAttribute("data-thumb") || "";
    if (!src && img.srcset) src = img.srcset.split(" ")[0];
    return src;
  }

  function scrape() {
    const rows = [];
    const seen = new Set();
    itemNodes().forEach((node) => {
      const link =
        node.querySelector("a#video-title-link") ||
        node.querySelector("a#video-title") ||
        node.querySelector("#video-title") ||
        node.querySelector('a#thumbnail[href*="watch"]');
      if (!link) return;

      const href = link.href || "";
      const idMatch = href.match(/[?&]v=([\w-]+)/);
      const id = idMatch ? idMatch[1] : href;
      if (!id || seen.has(id)) return;
      seen.add(id);

      const title = (link.getAttribute("title") || link.textContent || "").trim();
      if (!title) return;

      // metadata line: [views, date]
      const metas = node.querySelectorAll(
        "#metadata-line span.inline-metadata-item, #metadata-line span, .inline-metadata-item"
      );
      let viewsText = "";
      let dateText = "";
      metas.forEach((s) => {
        const txt = s.textContent.trim();
        if (/view/i.test(txt)) viewsText = txt;
        else if (/ago|streamed|premier/i.test(txt)) dateText = txt;
      });
      if (!viewsText && metas[0]) viewsText = metas[0].textContent.trim();
      if (!dateText && metas[1]) dateText = metas[1].textContent.trim();

      rows.push({
        title,
        url: href.split("&")[0],
        views: parseViews(viewsText),
        viewsText: viewsText || "—",
        date: dateText || "—",
        thumbnail:
          bestThumb(node) ||
          (id && !id.startsWith("http")
            ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
            : ""),
      });
    });
    return rows;
  }

  function channelName() {
    const el =
      document.querySelector("yt-formatted-string.ytd-channel-name") ||
      document.querySelector("#channel-name #text") ||
      document.querySelector("ytd-channel-name #text") ||
      document.querySelector("#channel-header #text");
    return (el && el.textContent.trim()) || document.title.replace(/ - YouTube$/, "").trim();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.action === "collect") {
      autoScroll((count) => {
        chrome.runtime.sendMessage({ action: "progress", count }).catch(() => {});
      }).then(() => {
        const rows = scrape();
        sendResponse({ ok: true, rows, channel: channelName() });
      });
      return true; // async response
    }
    if (msg && msg.action === "ping") {
      sendResponse({ ok: true, isChannel: /\/@|\/channel\/|\/c\/|\/user\//.test(location.pathname) });
      return true;
    }
  });
})();
