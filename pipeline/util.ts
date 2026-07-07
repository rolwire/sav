import * as fs from "fs";
import * as path from "path";

export const USER_AGENT =
  "sav-mapreel-pipeline/1.0 (https://github.com/rolwire/sav)";

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

export const fetchJson = async <T>(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> => {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...extraHeaders },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
};

export const downloadFile = async (
  url: string,
  dest: string,
  retries = 3
): Promise<void> => {
  if (fs.existsSync(dest)) return; // cached from a previous run
  ensureDir(path.dirname(dest));
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return;
    } catch (err) {
      if (attempt >= retries) throw new Error(`download ${url}: ${err}`);
      await sleep(500 * attempt);
    }
  }
};

/** Run `fn` over `items` with at most `concurrency` in flight. */
export const pool = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }
  );
  await Promise.all(workers);
  return results;
};

export const stripHtml = (s: string): string =>
  s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Minimal CLI arg parser: --key value / --flag */
export const parseArgs = (
  argv: string[]
): Record<string, string | boolean> => {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
};
