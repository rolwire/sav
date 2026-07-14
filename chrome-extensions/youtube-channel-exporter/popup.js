/* YouTube Channel Exporter — popup controller. */
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { videos: [], channel: "youtube-channel", tabId: null };

  function notice(msg, kind = "info") {
    const el = $("notice");
    el.textContent = msg;
    el.className = `notice ${kind}`;
    el.classList.remove("hidden");
  }
  function clearNotice() { $("notice").classList.add("hidden"); }

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function sendMessage(tabId, msg) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(resp);
      });
    });
  }

  async function ensureContentScript(tabId) {
    let resp = await sendMessage(tabId, { type: "YCE_PING" });
    if (resp && resp.ok) return resp.context;
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch (e) {
      return null;
    }
    resp = await sendMessage(tabId, { type: "YCE_PING" });
    return resp && resp.ok ? resp.context : null;
  }

  function renderContext(ctx) {
    if (!ctx) {
      $("context").innerHTML = "Open a <strong>youtube.com</strong> channel page, then reopen this popup.";
      $("scan").disabled = true;
      return;
    }
    $("scan").disabled = false;
    if (ctx.onChannel) {
      const where = ctx.onVideosTab ? "Videos tab" : "channel page";
      $("context").innerHTML = `On <strong>${ctx.channelName || "channel"}</strong> (${where}). ${ctx.videoCount} videos visible now.`;
      if (!ctx.onVideosTab) {
        notice("For a full export, open the channel's Videos tab first.", "info");
      }
    } else if (ctx.onSearch) {
      $("context").innerHTML = `On a <strong>search results</strong> page — ${ctx.videoCount} videos visible. You can still scan & export these.`;
    } else {
      $("context").innerHTML = `${ctx.videoCount} videos visible on this page. Open a channel's Videos tab for a full export.`;
    }
  }

  function sortVideos(videos, mode) {
    const v = videos.slice();
    const byViews = (a, b) => (b.views ?? -1) - (a.views ?? -1);
    if (mode === "views_desc") v.sort(byViews);
    else if (mode === "views_asc") v.sort((a, b) => (a.views ?? Infinity) - (b.views ?? Infinity));
    else if (mode === "title") v.sort((a, b) => a.title.localeCompare(b.title));
    // "date" keeps the channel's own order.
    return v;
  }

  function renderResults() {
    const sorted = sortVideos(state.videos, $("sort").value);
    state.sorted = sorted;

    $("count").textContent = sorted.length;
    const total = sorted.reduce((s, v) => s + (v.views || 0), 0);
    $("totalViews").textContent = fmt(total);

    const preview = $("preview");
    preview.innerHTML = "";
    sorted.slice(0, 100).forEach((v) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <img loading="lazy" src="${v.thumbnail}" alt="" />
        <div class="rtitle">${escapeHtml(v.title)}</div>
        <div class="rviews">${fmt(v.views)}</div>`;
      preview.appendChild(row);
    });
    if (sorted.length > 100) {
      const more = document.createElement("div");
      more.style.cssText = "font-size:11px;color:var(--muted);text-align:center;padding:4px";
      more.textContent = `+ ${sorted.length - 100} more in the export`;
      preview.appendChild(more);
    }
    $("results").classList.remove("hidden");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function exportRows() {
    return (state.sorted || state.videos).map((v, i) => ({
      rank: i + 1,
      title: v.title,
      views: v.views == null ? "" : v.views,
      viewsShown: v.viewsText || "",
      published: v.published || "",
      duration: v.duration || "",
      url: v.url || "",
      watchLabel: "Watch ▶",
      thumbnail: v.thumbnail || "",
      thumbLabel: "Thumbnail",
    }));
  }

  const COLUMNS = [
    { key: "rank", header: "#", type: "number", width: 6 },
    { key: "title", header: "Title", type: "string", width: 62 },
    { key: "views", header: "Views", type: "number", width: 14 },
    { key: "viewsShown", header: "Views (shown)", type: "string", width: 14 },
    { key: "published", header: "Published", type: "string", width: 16 },
    { key: "duration", header: "Duration", type: "string", width: 10 },
    { key: "url", header: "Video", type: "link", label: "watchLabel", width: 12 },
    { key: "thumbnail", header: "Thumbnail", type: "link", label: "thumbLabel", width: 12 },
  ];

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "channel";
  }
  function filenameBase() {
    const date = new Date().toISOString().slice(0, 10);
    return `${slug(state.channel)}-videos-${date}`;
  }

  // ---- Actions ----------------------------------------------------------
  async function doScan() {
    clearNotice();
    $("scan").disabled = true;
    $("progress").classList.remove("hidden");
    $("progressText").textContent = "Loading videos…";

    const options = {
      autoScroll: $("autoScroll").checked,
      maxVideos: parseInt($("maxVideos").value, 10) || 0,
      scrollDelay: 700,
    };

    const resp = await sendMessage(state.tabId, { type: "YCE_SCAN", options });
    $("progress").classList.add("hidden");
    $("scan").disabled = false;

    if (!resp || !resp.ok) {
      notice("Scan failed: " + (resp && resp.error ? resp.error : "no response from page. Reload the YouTube tab and try again."), "error");
      return;
    }
    if (!resp.videos.length) {
      notice("No videos found on this page. Open a channel's Videos tab and try again.", "warn");
      return;
    }
    state.videos = resp.videos;
    state.channel = resp.channel || state.channel;
    notice(`Scanned ${resp.videos.length} videos from ${state.channel}.`, "ok");
    renderResults();
  }

  function copyTitles() {
    const titles = (state.sorted || state.videos).map((v) => v.title).join("\n");
    navigator.clipboard.writeText(titles).then(
      () => notice(`Copied ${(state.sorted || state.videos).length} titles to clipboard.`, "ok"),
      () => notice("Clipboard blocked by the browser. Try again.", "error")
    );
  }

  function exportXlsx() {
    try {
      const data = XLSXLite.buildXlsx("Videos", COLUMNS, exportRows());
      XLSXLite.download(filenameBase(), "xlsx", data);
      notice("Excel file downloaded.", "ok");
    } catch (e) {
      notice("Export failed: " + e.message, "error");
    }
  }

  function exportCsv() {
    const csv = XLSXLite.buildCsv(COLUMNS, exportRows());
    XLSXLite.download(filenameBase(), "csv", csv);
    notice("CSV file downloaded.", "ok");
  }

  // ---- Progress messages from the content script ------------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "YCE_PROGRESS" && msg.phase === "scrolling") {
      $("progressText").textContent = `Loading videos… ${msg.loaded} found`;
    }
  });

  // ---- Init -------------------------------------------------------------
  async function init() {
    const tab = await getActiveTab();
    if (!tab || !/^https:\/\/www\.youtube\.com\//.test(tab.url || "")) {
      renderContext(null);
      $("context").innerHTML = "This isn't a YouTube tab. Open <strong>youtube.com</strong> and reopen the popup.";
      return;
    }
    state.tabId = tab.id;
    const ctx = await ensureContentScript(tab.id);
    renderContext(ctx);
    if (ctx) state.channel = ctx.channelName || state.channel;
  }

  $("scan").addEventListener("click", doScan);
  $("copyTitles").addEventListener("click", copyTitles);
  $("exportXlsx").addEventListener("click", exportXlsx);
  $("exportCsv").addEventListener("click", exportCsv);
  $("sort").addEventListener("change", () => { if (state.videos.length) renderResults(); });

  init();
})();
