/* YouTube New-Channels Sorter — popup controller. */
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { tabId: null };

  function notice(msg, kind = "info") {
    const el = $("notice");
    el.textContent = msg;
    el.className = `notice ${kind}`;
    el.classList.remove("hidden");
  }
  function clearNotice() { $("notice").classList.add("hidden"); }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  function send(tabId, msg) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        resolve(chrome.runtime.lastError ? null : resp);
      });
    });
  }
  async function ensureContentScript(tabId) {
    let resp = await send(tabId, { type: "YNCS_PING" });
    if (resp) return resp;
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    } catch (e) { return null; }
    return await send(tabId, { type: "YNCS_PING" });
  }

  function readOptions() {
    return {
      mode: $("mode").value,
      maxSubs: parseInt($("maxSubs").value, 10) || Infinity,
      maxAgeDays: parseInt($("maxAge").value, 10) || Infinity,
      hideOthers: $("hideOthers").checked,
    };
  }

  function saveDefaults() {
    chrome.storage.local.set({
      yncsDefaults: {
        mode: $("mode").value,
        maxSubs: $("maxSubs").value,
        maxAge: $("maxAge").value,
        hideOthers: $("hideOthers").checked,
      },
    });
  }
  function loadDefaults() {
    return new Promise((resolve) => {
      chrome.storage.local.get("yncsDefaults", (r) => {
        const d = r.yncsDefaults;
        if (d) {
          $("mode").value = d.mode ?? "opportunity";
          $("maxSubs").value = d.maxSubs ?? "50000";
          $("maxAge").value = d.maxAge ?? "365";
          $("hideOthers").checked = !!d.hideOthers;
        }
        resolve();
      });
    });
  }

  async function apply() {
    clearNotice();
    saveDefaults();
    $("apply").disabled = true;
    $("progress").classList.remove("hidden");
    $("progressText").textContent = "Reading channels…";

    const resp = await send(state.tabId, { type: "YNCS_ANALYZE", options: readOptions() });

    $("progress").classList.add("hidden");
    $("apply").disabled = false;

    if (!resp || !resp.ok) {
      notice((resp && resp.error) || "Couldn't analyze this page. Reload the search and try again.", "error");
      return;
    }
    $("sTotal").textContent = resp.total;
    $("sChannels").textContent = resp.channels;
    $("sNew").textContent = resp.newCount;
    $("summary").classList.remove("hidden");
    $("reset").classList.remove("hidden");
    notice(`Sorted ${resp.total} results — ${resp.newCount} from new/small channels.`, "ok");
  }

  async function reset() {
    await send(state.tabId, { type: "YNCS_RESET" });
    $("summary").classList.add("hidden");
    $("reset").classList.add("hidden");
    notice("Restored YouTube's original order.", "info");
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "YNCS_PROGRESS" && msg.phase === "fetching") {
      $("progressText").textContent = msg.total
        ? `Reading channels… ${msg.done}/${msg.total}`
        : "Reading channels…";
    }
  });

  async function init() {
    await loadDefaults();
    const tab = await getActiveTab();
    if (!tab || !/^https:\/\/www\.youtube\.com\//.test(tab.url || "")) {
      $("context").innerHTML = "Open <strong>youtube.com</strong> and search for a topic, then reopen this popup.";
      $("apply").disabled = true;
      return;
    }
    state.tabId = tab.id;
    const ctx = await ensureContentScript(tab.id);
    if (!ctx) {
      $("context").innerHTML = "Couldn't connect to the page. Reload the YouTube tab and try again.";
      $("apply").disabled = true;
      return;
    }
    if (ctx.onSearch) {
      $("context").innerHTML = ctx.query
        ? `Search results for <strong>"${ctx.query}"</strong>. Ready to sort.`
        : "On a search results page. Ready to sort.";
      if (ctx.applied) { $("reset").classList.remove("hidden"); }
    } else {
      $("context").innerHTML = "This isn't a search page. Search for a topic on YouTube, then reopen this popup.";
      $("apply").disabled = true;
    }
  }

  $("apply").addEventListener("click", apply);
  $("reset").addEventListener("click", reset);
  init();
})();
