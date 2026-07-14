/* YouTube New-Channels Sorter — content script
 *
 * On a YouTube search results page it re-orders the video results to surface
 * newer / smaller channels first, instead of the algorithm's usual big-channel
 * ranking. It also offers a "one video per channel" mode to help you discover
 * as many distinct new channels as possible for a topic.
 *
 * How "new channel" is estimated: the search DOM does not expose a channel's
 * creation date or subscriber count, so we use the two strongest signals that
 * *are* on the page as proxies:
 *   - upload recency  (fresher upload  => more likely an active/new channel)
 *   - view count      (fewer views     => more likely a smaller/newer channel)
 * These are heuristics, not exact channel ages, and the badge on each result
 * shows the values used so the ranking is transparent.
 */

(() => {
  if (window.__ncsLoaded) return;
  window.__ncsLoaded = true;

  const STORE_KEY = "ncs_settings";
  let settings = { enabled: true, mode: "balanced", dedupe: false, freshDays: 30 };

  /* ---------- parsing helpers ---------- */

  // "3 days ago" / "2 weeks ago" / "Streamed 1 year ago" -> approx days
  function parseAgeDays(text) {
    if (!text) return Infinity;
    const t = text.toLowerCase();
    const m = t.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
    if (!m) return Infinity;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const map = {
      second: 1 / 86400,
      minute: 1 / 1440,
      hour: 1 / 24,
      day: 1,
      week: 7,
      month: 30,
      year: 365,
    };
    return n * (map[unit] || 1);
  }

  // "1.2M views" / "12K views" / "1,234 views" / "No views" -> integer
  function parseViews(text) {
    if (!text) return 0;
    const t = text.toLowerCase().replace(/views?/, "").replace(/,/g, "").trim();
    if (t.startsWith("no")) return 0;
    const m = t.match(/([\d.]+)\s*([kmb])?/);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    const u = m[2];
    if (u === "k") n *= 1e3;
    else if (u === "m") n *= 1e6;
    else if (u === "b") n *= 1e9;
    return Math.round(n);
  }

  function resultNodes() {
    return Array.from(document.querySelectorAll("ytd-video-renderer"));
  }

  function extract(node) {
    const metaSpans = node.querySelectorAll(
      "#metadata-line span.inline-metadata-item, #metadata-line span"
    );
    let viewsText = "";
    let dateText = "";
    metaSpans.forEach((s) => {
      const txt = s.textContent.trim();
      if (/view/i.test(txt)) viewsText = txt;
      else if (/ago|streamed|premier/i.test(txt)) dateText = txt;
    });
    const chLink = node.querySelector(
      "ytd-channel-name a, #channel-name a, .ytd-channel-name a"
    );
    const channel = chLink
      ? (chLink.getAttribute("href") || chLink.textContent.trim())
      : "unknown";
    return {
      views: parseViews(viewsText),
      ageDays: parseAgeDays(dateText),
      channel,
    };
  }

  /* ---------- scoring ---------- */

  function scoreFor(info, mode) {
    // lower score = shown higher
    switch (mode) {
      case "newest":
        return info.ageDays;
      case "smallest":
        return info.views;
      case "balanced":
      default: {
        // rank-blend of recency and smallness, both "lower is better"
        // log-dampen views so a 10M vs 1M gap doesn't dwarf recency
        const viewScore = Math.log10(info.views + 10); // ~1..8
        const ageScore = Math.log10(info.ageDays + 1); // ~0..2.7
        return viewScore + ageScore;
      }
    }
  }

  function badgeFor(node, info) {
    let badge = node.querySelector(".ncs-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ncs-badge";
      const meta = node.querySelector("#metadata-line") || node.querySelector("#meta");
      (meta || node).appendChild(badge);
    }
    const ageLabel =
      info.ageDays === Infinity
        ? "age ?"
        : info.ageDays < 1
        ? "today"
        : info.ageDays < 45
        ? `${Math.round(info.ageDays)}d`
        : info.ageDays < 365
        ? `${Math.round(info.ageDays / 30)}mo`
        : `${(info.ageDays / 365).toFixed(1)}y`;
    const viewLabel =
      info.views >= 1e6
        ? (info.views / 1e6).toFixed(1) + "M"
        : info.views >= 1e3
        ? Math.round(info.views / 1e3) + "K"
        : String(info.views);
    badge.textContent = `🕓 ${ageLabel}  ·  👁 ${viewLabel}`;
    badge.classList.toggle("new", info.ageDays <= settings.freshDays);
    badge.classList.toggle("small", info.views < 5000);
  }

  /* ---------- reordering ---------- */

  let applying = false;

  function apply() {
    if (applying) return;
    applying = true;
    try {
      const nodes = resultNodes();
      if (!nodes.length) return;

      // annotate every result with a badge (even when disabled — it's useful)
      const entries = nodes.map((node) => {
        const info = extract(node);
        badgeFor(node, info);
        return { node, info };
      });

      if (!settings.enabled) {
        entries.forEach((e) => (e.node.style.display = ""));
        updateCount(entries.length, entries.length);
        return;
      }

      // group nodes by their DOM parent so we sort within each results list
      const byParent = new Map();
      entries.forEach((e) => {
        const p = e.node.parentElement;
        if (!p) return;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p).push(e);
      });

      const seenChannels = new Set();
      let shown = 0;

      byParent.forEach((group, parent) => {
        group.sort(
          (a, b) => scoreFor(a.info, settings.mode) - scoreFor(b.info, settings.mode)
        );
        // re-attach in sorted order
        group.forEach((e) => parent.appendChild(e.node));
        // dedupe pass (per channel) if requested
        group.forEach((e) => {
          if (settings.dedupe) {
            if (seenChannels.has(e.info.channel)) {
              e.node.style.display = "none";
              return;
            }
            seenChannels.add(e.info.channel);
          }
          e.node.style.display = "";
          shown++;
        });
      });

      updateCount(shown, entries.length);
    } finally {
      applying = false;
    }
  }

  function updateCount(shown, total) {
    const el = document.getElementById("ncs-count");
    if (!el) return;
    if (!settings.enabled) el.textContent = `Off · ${total} results`;
    else if (settings.dedupe)
      el.textContent = `${shown} channels shown (${total} results)`;
    else el.textContent = `${total} results re-sorted`;
  }

  /* ---------- UI panel ---------- */

  function buildPanel() {
    if (document.getElementById("ncs-panel")) return;
    const panel = document.createElement("div");
    panel.id = "ncs-panel";
    panel.innerHTML = `
      <h2 id="ncs-head"><span><span class="ncs-dot">●</span>New-Channel Sort</span><span class="ncs-caret">▾</span></h2>
      <div class="ncs-body">
        <div class="ncs-switch">
          <label for="ncs-enabled">Enable re-sort</label>
          <input type="checkbox" id="ncs-enabled" />
        </div>
        <div>
          <label class="ncs-note" for="ncs-mode">Sort videos by</label>
          <select id="ncs-mode">
            <option value="balanced">New &amp; small (balanced)</option>
            <option value="newest">Newest uploads first</option>
            <option value="smallest">Smallest channels first</option>
          </select>
        </div>
        <div class="ncs-switch">
          <label for="ncs-dedupe">One video per channel</label>
          <input type="checkbox" id="ncs-dedupe" />
        </div>
        <div id="ncs-count" class="ncs-count"></div>
        <div class="ncs-note">Uses upload recency &amp; view count as proxies for
          channel age/size (YouTube hides exact figures on search).</div>
      </div>`;
    document.body.appendChild(panel);

    const en = panel.querySelector("#ncs-enabled");
    const mode = panel.querySelector("#ncs-mode");
    const dd = panel.querySelector("#ncs-dedupe");
    en.checked = settings.enabled;
    mode.value = settings.mode;
    dd.checked = settings.dedupe;

    const save = () => {
      settings.enabled = en.checked;
      settings.mode = mode.value;
      settings.dedupe = dd.checked;
      try { chrome.storage.local.set({ [STORE_KEY]: settings }); } catch {}
      apply();
    };
    en.addEventListener("change", save);
    mode.addEventListener("change", save);
    dd.addEventListener("change", save);

    panel.querySelector("#ncs-head").addEventListener("click", () => {
      panel.classList.toggle("collapsed");
      panel.querySelector(".ncs-caret").textContent =
        panel.classList.contains("collapsed") ? "▸" : "▾";
    });
  }

  /* ---------- lifecycle ---------- */

  let debounce;
  function scheduleApply() {
    clearTimeout(debounce);
    debounce = setTimeout(apply, 350);
  }

  function observeResults() {
    const container =
      document.querySelector("ytd-section-list-renderer #contents") ||
      document.querySelector("#page-manager") ||
      document.body;
    const obs = new MutationObserver(() => {
      if (location.pathname !== "/results") return;
      scheduleApply();
    });
    obs.observe(container, { childList: true, subtree: true });
  }

  function init() {
    if (location.pathname !== "/results") return;
    buildPanel();
    scheduleApply();
  }

  try {
    chrome.storage.local.get(STORE_KEY, (res) => {
      if (res && res[STORE_KEY]) settings = { ...settings, ...res[STORE_KEY] };
      init();
      observeResults();
    });
  } catch {
    init();
    observeResults();
  }

  // YouTube is a single-page app — react to in-app navigation
  window.addEventListener("yt-navigate-finish", () => {
    if (location.pathname === "/results") {
      buildPanel();
      scheduleApply();
    } else {
      const p = document.getElementById("ncs-panel");
      if (p) p.remove();
    }
  });
})();
