export interface CoreDataResult {
  found: boolean;
  data: unknown;
  /** Set when __CORE_DATA__ exists but can't be serialized (e.g. circular). */
  error?: string;
}

/** Assets served from one versioned build, e.g. `assets-bucket.tiket.com/homepage-v4/v4.5.0/_next/…`. */
export interface AssetBundle {
  origin: string;
  /** Service name, e.g. `homepage-v4`. */
  service: string;
  version: string;
  urls: string[];
}

export interface NextDataResult {
  url: string;
  source: "window" | "script-tag" | null;
  isAppRouter: boolean;
  data: NextData | null;
  core: CoreDataResult;
  bundles: AssetBundle[];
  /** Remote asset URLs under `…/shared-components/…`; never counted as part of a service build. */
  shared: string[];
}

// Executed in the page's MAIN world (via inspectedWindow.eval or scripting.executeScript).
// Must be self-contained: it is serialized with Function.prototype.toString.
export function readNextData(): NextDataResult {
  const live = window.__NEXT_DATA__;
  const el = document.getElementById("__NEXT_DATA__");
  let fromScriptTag: NextData | null = null;
  if (el) {
    try {
      fromScriptTag = JSON.parse(el.textContent ?? "");
    } catch {}
  }
  const data = live ?? fromScriptTag;

  let core: CoreDataResult = { found: false, data: null };
  if (window.__CORE_DATA__ !== undefined) {
    try {
      core = { found: true, data: JSON.parse(JSON.stringify(window.__CORE_DATA__)) };
    } catch (err) {
      core = { found: true, data: null, error: String(err) };
    }
  }

  // The deployed version is in the asset path: <origin>/<service>/v4.5.0/_next/…
  // Tags cover what the HTML ships; resource timing adds chunks loaded later.
  const urls = new Set<string>();
  document.querySelectorAll("script[src], link[href]").forEach((el) => {
    urls.add((el as HTMLScriptElement).src || (el as HTMLLinkElement).href);
  });
  for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
  const bundles = new Map<string, AssetBundle>();
  const shared: string[] = [];
  for (const url of urls) {
    if (url.includes("/shared-components/")) {
      shared.push(url);
      continue;
    }
    const m = url.match(/^(https?:\/\/[^/]+)\/(?:(.*?)\/)?(v?\d+(?:\.\d+)+[\w.-]*)\/_next\//);
    if (!m) continue;
    const [, origin = "", service = "", version = ""] = m;
    const key = `${origin}/${service}/${version}`;
    if (!bundles.has(key)) bundles.set(key, { origin, service, version, urls: [] });
    bundles.get(key)!.urls.push(url);
  }

  return {
    url: location.href,
    source: live ? "window" : fromScriptTag ? "script-tag" : null,
    // App Router pages have no __NEXT_DATA__; they stream RSC payload via self.__next_f.
    isAppRouter: !data && Array.isArray(self.__next_f),
    data: data ? JSON.parse(JSON.stringify(data)) : null,
    core,
    bundles: [...bundles.values()],
    shared,
  };
}
