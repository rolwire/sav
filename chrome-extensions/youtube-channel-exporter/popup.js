/* Popup controller: talks to the content script, holds the collected data,
 * and handles copy / xlsx / csv export.
 */
let DATA = [];
let CHANNEL = "youtube-channel";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const previewEl = $("preview");

function setStatus(msg) { statusEl.textContent = msg; }

function sortedData() {
  const rows = DATA.slice();
  if ($("sortViews").checked) rows.sort((a, b) => b.views - a.views);
  return rows;
}

function renderPreview() {
  const rows = sortedData();
  previewEl.innerHTML = "";
  rows.slice(0, 40).forEach((r) => {
    const div = document.createElement("div");
    div.className = "item";
    const img = document.createElement("img");
    img.src = r.thumbnail;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    const meta = document.createElement("div");
    meta.className = "meta";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = r.title;
    const v = document.createElement("div");
    v.className = "v";
    v.textContent = `${r.viewsText} · ${r.date}`;
    meta.appendChild(t);
    meta.appendChild(v);
    div.appendChild(img);
    div.appendChild(meta);
    previewEl.appendChild(div);
  });
  if (rows.length > 40) {
    const more = document.createElement("div");
    more.className = "v";
    more.style.padding = "8px 0";
    more.textContent = `+ ${rows.length - 40} more…`;
    previewEl.appendChild(more);
  }
}

function enableExports(on) {
  $("copyTitles").disabled = !on;
  $("exportXlsx").disabled = !on;
  $("exportCsv").disabled = !on;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(s) {
  return (s || "channel").replace(/[^\w\-]+/g, "_").slice(0, 60);
}

// live progress from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === "progress") {
    setStatus(`Scrolling… loaded ${msg.count} videos so far.`);
  }
});

$("collect").addEventListener("click", async () => {
  enableExports(false);
  setStatus("Starting… make sure you're on a channel's Videos tab.");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/youtube\.com/.test(tab.url || "")) {
      setStatus("Open a YouTube channel page first.");
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, { action: "collect" });
    if (!res || !res.ok) {
      setStatus("Could not read the page. Reload the YouTube tab and retry.");
      return;
    }
    DATA = res.rows || [];
    CHANNEL = res.channel || "youtube-channel";
    if (!DATA.length) {
      setStatus("No videos found. Are you on the channel's Videos tab?");
      return;
    }
    renderPreview();
    enableExports(true);
    setStatus(`Collected ${DATA.length} videos from “${CHANNEL}”.`);
  } catch (e) {
    setStatus("Error: " + e.message + "\nTip: reload the YouTube tab, then retry.");
  }
});

$("sortViews").addEventListener("change", () => {
  if (DATA.length) renderPreview();
});

$("copyTitles").addEventListener("click", async () => {
  const titles = sortedData().map((r) => r.title).join("\n");
  try {
    await navigator.clipboard.writeText(titles);
    setStatus(`Copied ${DATA.length} titles to clipboard.`);
  } catch {
    setStatus("Clipboard blocked. Titles logged to console instead.");
    console.log(titles);
  }
});

$("exportCsv").addEventListener("click", () => {
  const rows = sortedData();
  const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const header = ["Title", "Views", "Views (raw)", "Uploaded", "Video URL", "Thumbnail URL"];
  const lines = [header.map(q).join(",")];
  rows.forEach((r) => {
    lines.push([r.title, r.viewsText, r.views, r.date, r.url, r.thumbnail].map(q).join(","));
  });
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  download(blob, `${safeName(CHANNEL)}_videos.csv`);
  setStatus(`Exported ${rows.length} videos to CSV.`);
});

$("exportXlsx").addEventListener("click", () => {
  const rows = sortedData();
  const header = [
    { v: "Title", header: true },
    { v: "Views", header: true },
    { v: "Uploaded", header: true },
    { v: "Video URL", header: true },
    { v: "Thumbnail URL", header: true },
  ];
  const sheet = [header];
  rows.forEach((r) => {
    sheet.push([
      { text: r.title, link: r.url },
      { v: r.views, num: true },
      r.date,
      { text: r.url, link: r.url },
      { text: r.thumbnail, link: r.thumbnail },
    ]);
  });
  const blob = window.XlsxWriter.build("Videos", sheet);
  download(blob, `${safeName(CHANNEL)}_videos.xlsx`);
  setStatus(`Exported ${rows.length} videos to Excel (.xlsx).`);
});
