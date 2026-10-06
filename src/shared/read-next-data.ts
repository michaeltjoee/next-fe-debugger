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

/** What the API Fetch tab lists: the hook's calls, plus any the browser timed that the hook missed. */
export interface GatewayResult {
  /** False when the hook isn't in the page, e.g. the page was open before the extension loaded. */
  recording: boolean;
  session: number;
  /** Hook version and timed-call count; changes whenever the list would. See gatewayStamp. */
  stamp: string;
  calls: GatewayCall[];
}

/** What the dataLayer tab lists: window.dataLayer from the last Clear on. */
export interface DataLayerResult {
  /** False when the page has no window.dataLayer array. */
  found: boolean;
  session: number;
  /** dataLayer index of the first entry in `entries`; the ones before it were cleared. */
  start: number;
  /** As JSON: gtag() calls (arguments objects) become arrays, DOM nodes and cycles become labels. */
  entries: unknown[];
  /** Length and clear point; changes whenever the list would. See dataLayerStamp. */
  stamp: string;
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
  gateway: GatewayResult;
  dataLayer: DataLayerResult;
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
    gateway: readGateway(),
    dataLayer: readDataLayer(),
  };

  function readDataLayer(): DataLayerResult {
    const list = window.dataLayer;
    const session = performance.timeOrigin;
    if (!Array.isArray(list)) return { found: false, session, start: 0, entries: [], stamp: "" };
    const start = Math.min(list.__clearedAt ?? 0, list.length);
    return {
      found: true,
      session,
      start,
      entries: list.slice(start).map(toJson),
      stamp: `${list.length}:${start}`,
    };
  }

  // GTM puts the clicked element in gtm.element, and entries can hold anything the page
  // pushed, so a plain JSON round trip can throw or walk the whole DOM.
  function toJson(value: unknown): unknown {
    const seen = new WeakSet<object>();
    try {
      const json = JSON.stringify(value, (_key, v: unknown) => {
        if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
        if (v === window) return "[Window]";
        if (v instanceof Element) {
          const id = v.id ? `#${v.id}` : "";
          const classes = [...v.classList].map((c) => `.${c}`).join("");
          return `[${v.tagName.toLowerCase()}${id}${classes}]`;
        }
        if (v instanceof Node) return `[${v.nodeName}]`;
        if (v !== null && typeof v === "object") {
          if (seen.has(v)) return "[Seen above]";
          seen.add(v);
          // gtag() pushes its arguments object; show it as the call's argument list.
          if (Object.prototype.toString.call(v) === "[object Arguments]") return Array.from(v as ArrayLike<unknown>);
        }
        return v;
      });
      return json === undefined ? null : JSON.parse(json);
    } catch (err) {
      return `[Can't show as JSON: ${err}]`;
    }
  }

  // Resource timing sees every fetch/XHR the page finished, even ones the hook missed
  // (page open before the extension loaded, or a fetch saved before the hook wrapped it).
  // It has no method or bodies, so those calls are listed as unrecorded.
  function readGateway(): GatewayResult {
    const log: GatewayLog | undefined = window.__MS_GATEWAY__;
    const calls: GatewayCall[] = log ? JSON.parse(JSON.stringify(log.calls)) : [];
    const timed = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
      (e) => e.name.includes("/ms-gateway/") && (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest"),
    );
    const recorded = new Map<string, number>();
    for (const c of calls) recorded.set(c.url, (recorded.get(c.url) ?? 0) + 1);
    timed.forEach((e, i) => {
      const left = recorded.get(e.name) ?? 0;
      if (left) {
        recorded.set(e.name, left - 1);
        return;
      }
      calls.push({
        id: -(i + 1),
        via: e.initiatorType === "fetch" ? "fetch" : "xhr",
        method: "",
        url: e.name,
        startedAt: e.startTime,
        requestHeaders: {},
        requestBody: null,
        // 0 means the browser couldn't tell (e.g. cross-origin without timing access).
        status: e.responseStatus || undefined,
        size: e.decodedBodySize || undefined,
        duration: e.duration,
        unrecorded: true,
      });
    });
    calls.sort((a, b) => a.startedAt - b.startedAt);
    return {
      recording: !!log,
      session: log?.session ?? performance.timeOrigin,
      stamp: `${log?.version ?? 0}:${timed.length}`,
      calls,
    };
  }
}

/** The Gateway stamp alone, for cheap polling. Same counts as readGateway; self-contained like readNextData. */
export function gatewayStamp(): string {
  const timed = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
    (e) => e.name.includes("/ms-gateway/") && (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest"),
  );
  return `${window.__MS_GATEWAY__?.version ?? 0}:${timed.length}`;
}

/** The dataLayer stamp alone, for cheap polling. Same as readDataLayer's; self-contained like readNextData. */
export function dataLayerStamp(): string {
  const list = window.dataLayer;
  return Array.isArray(list) ? `${list.length}:${Math.min(list.__clearedAt ?? 0, list.length)}` : "";
}

/**
 * The dataLayer tab's Clear: hides the entries so far by marking where the tab starts.
 * The page's dataLayer is left as is, so GTM and the page's own code never notice.
 * Self-contained like readNextData.
 */
export function clearDataLayer(): void {
  const list = window.dataLayer;
  if (!Array.isArray(list)) return;
  Object.defineProperty(list, "__clearedAt", { value: list.length, writable: true, configurable: true });
}
