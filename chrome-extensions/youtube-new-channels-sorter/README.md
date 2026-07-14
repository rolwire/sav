# YouTube New-Channels Sorter

Search a topic on YouTube and re-order the results to surface videos from
**new, small or fast-growing channels** — the classic "find an under-served
niche" workflow. Each result gets a badge with the channel's subscriber count,
age, and how its views compare to its subscriber base.

![icon](icons/icon128.png)

## Features

- **Three sort modes**
  - **Opportunity** *(default)* — high views relative to a small, young channel (views-per-subscriber, boosted for younger channels).
  - **Newest channels first** — by the channel's join date.
  - **Fewest subscribers first** — smallest channels on top.
- **"New" thresholds** — mark a channel as new/small if it's **under N
  subscribers** (1K–100K) **or created within** the last 6 months / 1 / 2 years.
- **Per-result badges** — `👤 subscribers · 🗓 channel age · 🔥 views vs. subs`, plus a green **NEW** or **SMALL** chip.
- **Highlight & filter** — new/small channels get a green outline; optionally
  **hide** everything that isn't new.
- **Re-applies on new searches** — keep it on and it re-sorts as you search new topics.
- **Reset** — restore YouTube's original order any time.

## How to use

1. **Search a topic** on YouTube (`youtube.com/results?search_query=...`).
2. Click the **New-Channels Sorter** toolbar icon.
3. Pick a **sort mode** and your **"new" thresholds**.
4. Click **Analyze & sort this search**. It reads each channel and re-orders the page.
5. Use **Reset to YouTube order** to undo.

Your settings are remembered for next time.

## How it works

- `content.js` scans every `ytd-video-renderer` on the search page and finds each
  video's channel link.
- For each **unique** channel it fetches that channel's public **About** page
  (a same-origin `fetch`) and parses `ytInitialData` to read the **subscriber
  count** and **join date**. Results are cached per tab (`sessionStorage`) so
  repeat searches are fast, and fetches are concurrency-limited to be gentle.
- It injects a badge into each result and re-orders the list using CSS flex
  `order` on the results container — no DOM nodes are moved, so it doesn't fight
  YouTube's lazy-loading and resets cleanly.

## Permissions

- `activeTab`, `scripting` — to read and sort the current YouTube search page.
- `storage` — to remember your sort settings.
- `host_permissions: youtube.com` — it only runs on, and only fetches from, YouTube.

Nothing is sent to any third-party server.

## Notes & limitations

- Subscriber count and join date come from each channel's public About page. If
  a channel **hides** its subscriber count, the badge shows `?` and it sorts as
  "unknown size".
- Join dates are parsed from YouTube's English "Joined ..." text; on non-English
  YouTube locales the age may be unavailable (subscriber-based sorting still works).
- Analyzing a page fetches one small request per unique channel (typically
  10–20 per search), so the first analysis of a fresh search takes a few seconds.
- After you scroll to load more results, click **Analyze & sort** again to
  include the newly loaded videos.
