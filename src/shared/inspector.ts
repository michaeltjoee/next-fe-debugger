// What both the panel and the popup show: the deployed version, the page's
// ms-gateway calls, the page globals (__NEXT_DATA__ and __CORE_DATA__) together, and window.dataLayer.
import type { AssetBundle, DataLayerResult, GatewayResult, NextDataResult } from "./read-next-data.js";
import { emptyNote, flash, renderTree } from "./json-tree.js";

export type SourceId = "version" | "gateway" | "page" | "datalayer";

export const SOURCES: readonly { id: SourceId; label: string }[] = [
  { id: "version", label: "Version" },
  { id: "gateway", label: "API Fetch" },
  { id: "page", label: "Page Data" },
  { id: "datalayer", label: "dataLayer" },
];

type GlobalName = "__NEXT_DATA__" | "__CORE_DATA__";

/** The page globals the Page Data tab shows, in order, with null for one the page doesn't have. */
function globalsOf(result: NextDataResult): [GlobalName, unknown][] {
  const core = result.core.found && !result.core.error ? result.core.data : null;
  return [
    ["__NEXT_DATA__", result.data],
    ["__CORE_DATA__", core],
  ];
}

/** The active tab's value, or null when the page doesn't have it. Page Data is keyed by global. */
export function valueOf(result: NextDataResult, id: SourceId): unknown {
  if (id === "version") {
    const { bundles, shared } = result;
    return bundles.length || shared.length ? { bundles, shared } : null;
  }
  if (id === "gateway") return result.gateway.calls.length ? result.gateway.calls : null;
  if (id === "datalayer") return result.dataLayer.entries.length ? result.dataLayer.entries : null;
  const present = globalsOf(result).filter(([, value]) => value != null);
  return present.length ? Object.fromEntries(present) : null;
}

export function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
}

/**
 * The build this page was served from: the one __NEXT_DATA__.assetPrefix points at,
 * else the one that served the most assets.
 */
export function primaryBundle(result: NextDataResult): AssetBundle | null {
  const prefix = typeof result.data?.assetPrefix === "string" ? result.data.assetPrefix : "";
  const own = result.bundles.find((b) => prefix === [b.origin, b.service, b.version].filter(Boolean).join("/"));
  return own ?? [...result.bundles].sort((a, b) => b.urls.length - a.urls.length)[0] ?? null;
}

/** Whether a tab gets the filter/copy toolbar; Version is read at a glance. */
export function hasToolbar(id: SourceId): boolean {
  return id !== "version";
}

/** Page expression that logs the active tab; __NEXT_DATA__ falls back to the script tag like readNextData does. */
export function logExpression(result: NextDataResult, id: SourceId): string {
  if (id === "version") return `console.log("Assets", ${JSON.stringify(valueOf(result, id))})`;
  if (id === "gateway") return `console.log("ms-gateway calls", window.__MS_GATEWAY__?.calls)`;
  if (id === "datalayer") return `console.log("dataLayer", window.dataLayer?.slice(${result.dataLayer.start}))`;
  return `console.log({
    __NEXT_DATA__: window.__NEXT_DATA__ ?? JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent ?? "null"),
    __CORE_DATA__: window.__CORE_DATA__,
  })`;
}

export function renderBody(
  out: HTMLElement,
  result: NextDataResult,
  id: SourceId,
  { filter, raw, onClear }: { filter: string; raw: boolean; onClear?: () => void },
): void {
  // Page Data always renders: each global says on its own when the page doesn't have it.
  if (id === "page") {
    renderPageData(out, result, { filter, raw });
    return;
  }
  // So does dataLayer: once cleared it's empty but still has a Clear and a count to show.
  if (id === "datalayer") {
    renderDataLayer(out, result.dataLayer, { filter, raw, onClear });
    return;
  }
  if (valueOf(result, id) == null) {
    out.replaceChildren(emptyNote(missingMessage(result, id)));
    return;
  }
  if (id === "version") renderVersion(out, result);
  else renderGateway(out, result.gateway, { filter, raw });
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

/**
 * Service and version as the headline, then what the page loaded:
 * the service's own build against shared components, then each build's files.
 */
function renderVersion(out: HTMLElement, result: NextDataResult): void {
  const main = primaryBundle(result);
  const service = result.bundles.reduce((n, b) => n + b.urls.length, 0);
  const parts: HTMLElement[] = [];
  // Re-renders (Watch, new chunks loading) keep whichever groups the user opened.
  const opened = new Set(
    [...out.querySelectorAll<HTMLDetailsElement>("details.assets[open]")].map((d) => d.dataset.name),
  );

  if (main) {
    // Click to copy, like keys in the tree.
    const number = el("button", "version-number", main.version);
    number.type = "button";
    number.title = "Copy version";
    number.addEventListener("click", () => {
      navigator.clipboard.writeText(main.version);
      flash(number);
    });
    const hero = el("section", "version");
    hero.append(
      el("div", "version-service", main.service || "(root)"),
      number,
      el("div", "version-where", `Served from ${new URL(main.origin).host}`),
    );
    parts.push(hero);
  }

  parts.push(assetCounts(service, result.shared.length));

  for (const b of result.bundles) {
    const name = `${b.service || "(root)"} ${b.version}`;
    parts.push(assetGroup(name, "service", b.urls, (url) => after(url, "/_next/")));
  }
  if (result.shared.length) {
    parts.push(
      assetGroup("Shared components", "remote", result.shared, (url) => after(url, "/shared-components/")),
    );
  }

  for (const d of parts) {
    if (d instanceof HTMLDetailsElement) d.open = opened.has(d.dataset.name);
  }
  out.replaceChildren(...parts);
}

/** The part of a URL after a marker, so lists show `static/chunks/main-3f9a.js`, not the whole URL. */
function after(url: string, marker: string): string {
  const i = url.indexOf(marker);
  return i < 0 ? url : url.slice(i + marker.length);
}

/** File counts for the service build and shared components, and their total. */
function assetCounts(service: number, shared: number): HTMLElement {
  const table = el("table", "weight-table");
  table.setAttribute("aria-label", "Files loaded");
  const row = (label: string, kind: string, count: number) => {
    const tr = el("tr", kind ? "" : "total");
    const th = el("th");
    th.scope = "row";
    if (kind) th.append(el("span", `swatch ${kind}`));
    th.append(label);
    tr.append(th, el("td", "num", plural(count, "file")));
    return tr;
  };
  table.append(
    row("Service", "service", service),
    row("Shared components (remote)", "remote", shared),
    row("Total", "", service + shared),
  );
  const section = el("section", "weight");
  section.append(table);
  return section;
}

/** One build's files, in load order. Closed by default; the summary row carries the count. */
function assetGroup(
  name: string,
  kind: "service" | "remote",
  urls: string[],
  label: (url: string) => string,
): HTMLElement {
  const group = el("details", "assets");
  group.dataset.name = name;
  const head = el("summary");
  const title = el("span", "assets-name");
  title.append(el("span", `swatch ${kind}`), name);
  head.append(title, el("span", "num quiet", plural(urls.length, "file")));
  group.append(head);

  const list = el("ul");
  list.append(...urls.map((url) => {
    const li = el("li");
    const path = el("span", "path", label(url));
    path.title = url;
    li.append(path);
    return li;
  }));
  group.append(list);
  return group;
}

function missingMessage(result: NextDataResult, id: Exclude<SourceId, "page" | "datalayer">): string {
  if (id === "version") {
    return "No versioned or shared-component assets on this page. Looked for URLs shaped like …/<service>/v4.5.0/_next/… or …/shared-components/….";
  }
  return result.gateway.recording
    ? "No ms-gateway calls yet. Calls the page makes to …/ms-gateway/… show up here as they happen. Calls made on the server during SSR aren't visible to the browser."
    : "Not recording on this page yet. Reload the page to start recording ms-gateway calls.";
}

// ---------- Page Data tab ----------

/**
 * Both page globals in one scroll, __NEXT_DATA__ first. Each is a section whose head
 * stays pinned while its tree scrolls under it, so a long tree never hides which
 * global you're in. One filter searches both.
 */
function renderPageData(
  out: HTMLElement,
  result: NextDataResult,
  { filter, raw }: { filter: string; raw: boolean },
): void {
  const needle = filter.trim().toLowerCase();
  // Re-renders (filter, Watch) keep whichever sections the user closed.
  const closed = new Set(
    [...out.querySelectorAll<HTMLDetailsElement>("details.global:not([open])")].map((d) => d.dataset.name),
  );
  out.replaceChildren(
    ...globalsOf(result).map(([name, value]) => globalSection(result, name, value, needle, raw, !closed.has(name))),
  );
}

function globalSection(
  result: NextDataResult,
  name: GlobalName,
  value: unknown,
  needle: string,
  raw: boolean,
  open: boolean,
): HTMLElement {
  const section = el("details", "global");
  section.dataset.name = name;
  section.open = open;

  const head = el("summary", "global-head");
  head.append(el("span", "global-name", name));
  if (value == null) {
    head.append(el("span", "global-meta quiet", "Not on this page"));
    section.append(head, emptyNote(missingGlobal(result, name)));
    return section;
  }

  const size = el("span", "global-meta num quiet", formatBytes(JSON.stringify(value).length));
  size.title = "Size as JSON";
  const copy = el("button", "call-copy", "Copy");
  copy.type = "button";
  copy.title = `Copy ${name} as JSON`;
  copy.addEventListener("click", (e) => {
    // The button sits in the summary; don't let the click fold the section.
    e.preventDefault();
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    flash(copy);
  });
  head.append(size, copy);
  section.append(head);

  const facts = name === "__NEXT_DATA__" ? nextFacts(result) : null;
  if (facts) section.append(facts);

  const body = el("div", "global-body");
  if (raw) body.append(el("pre", "raw", JSON.stringify(value, null, 2)));
  else renderTree(body, value, { filter: needle, expandDepth: 3, rootPath: name, hideRoot: true });
  section.append(body);
  return section;
}

/**
 * The route and how it got its props, under the __NEXT_DATA__ head.
 * Unusual facts (fallback, read from the script tag) only show when true.
 */
function nextFacts(result: NextDataResult): HTMLElement | null {
  const data = result.data;
  if (!data) return null;
  const line = el("div", "summary");
  const span = (text: string, className: string, title: string) => {
    const s = el("span", className, text);
    s.title = title;
    return s;
  };
  const mode = data.gssp
    ? "getServerSideProps"
    : data.gip
      ? "getInitialProps"
      : data.nextExport
        ? "Static export"
        : "Static";
  line.append(
    span(data.page, "route", `Page route, build ${data.buildId}`),
    span(mode, "", "How the page got its props"),
  );
  if (data.isFallback) line.append(span("Fallback page", "", "isFallback is true"));
  if (result.source === "script-tag") {
    line.append(span("Read from the script tag", "", "window.__NEXT_DATA__ is missing"));
  }
  return line;
}

function missingGlobal(result: NextDataResult, name: GlobalName): string {
  if (name === "__CORE_DATA__") {
    return result.core.error
      ? `window.__CORE_DATA__ exists but can't be shown as JSON: ${result.core.error}`
      : "The page didn't set window.__CORE_DATA__.";
  }
  return result.isAppRouter
    ? "This looks like an App Router page, which streams its data through self.__next_f instead."
    : "Open a Next.js Pages Router page, then reload the data.";
}

// ---------- API Fetch tab ----------

/** Built rows by call, reused across re-renders so polling doesn't collapse what the user opened. */
const callRows = new WeakMap<HTMLElement, Map<string, HTMLDetailsElement>>();

/**
 * Every ms-gateway call in the order the page made it, one line each: method, path, status, time.
 * A row opens to the response; the request and response headers sit below it.
 */
function renderGateway(
  out: HTMLElement,
  log: GatewayResult,
  { filter, raw }: { filter: string; raw: boolean },
): void {
  const needle = filter.trim().toLowerCase();
  const previous = callRows.get(out) ?? new Map<string, HTMLDetailsElement>();
  const wasOpen = new Set([...previous.values()].filter((d) => d.open).map((d) => d.dataset.call));
  const next = new Map<string, HTMLDetailsElement>();

  for (const call of log.calls) {
    const line = `${call.method} ${call.url} ${call.status ?? ""}`.toLowerCase();
    const lineMatches = !needle || line.includes(needle);
    if (!lineMatches) {
      const inside = JSON.stringify([call.response, call.requestBody, call.requestHeaders, call.responseHeaders]);
      if (!inside.toLowerCase().includes(needle)) continue;
    }
    // Like the tree: a matching URL shows the whole call; otherwise the match is opened up inside.
    const inner = lineMatches ? "" : needle;
    const id = `${log.session}:${call.id}`;
    const key = [id, call.duration ?? "pending", JSON.stringify(call.requestBody)?.length, inner, raw].join("|");
    next.set(key, previous.get(key) ?? callRow(call, id, inner, raw, wasOpen.has(id) || !!inner));
  }
  callRows.set(out, next);

  const rows = [...next.values()];
  const list = el("div", "calls");
  if (rows.length) list.append(...rows);
  else list.append(emptyNote("No calls match the filter."));
  const parts: HTMLElement[] = [gatewaySummary(log.calls, rows.length, !!needle)];
  if (!log.recording) {
    parts.push(emptyNote("Not recording on this page, so these calls have no bodies. Reload the page to record them."));
  }
  out.replaceChildren(...parts, list);
}

function gatewaySummary(calls: GatewayCall[], shown: number, filtered: boolean): HTMLElement {
  const line = el("div", "summary");
  const count = filtered ? `${shown} of ${plural(calls.length, "call")}` : plural(calls.length, "call");
  line.append(el("span", "route", count));
  const failed = calls.filter(isFailed).length;
  if (failed) line.append(el("span", "bad", `${failed} failed`));
  const pending = calls.filter((c) => c.duration == null).length;
  if (pending) line.append(el("span", "", `${pending} pending`));
  const unrecorded = calls.filter((c) => c.unrecorded).length;
  if (unrecorded) {
    const span = el("span", "", `${unrecorded} not recorded`);
    span.title = "Seen in the browser's network timing, without method, headers or bodies";
    line.append(span);
  }
  const size = el("span", "", formatBytes(calls.reduce((n, c) => n + (c.size ?? 0), 0)));
  size.title = "Total response size";
  line.append(size);
  return line;
}

const isFailed = (c: GatewayCall) =>
  c.unrecorded ? (c.status ?? 0) >= 400 : c.duration != null && (!c.status || c.status >= 400 || !!c.error);

/** The gateway's own result code, when the body has one and it isn't SUCCESS (often with HTTP 200). */
function envelopeCode(response: unknown): string | null {
  const code = (response as { code?: unknown } | null)?.code;
  return typeof code === "string" && code !== "SUCCESS" ? code : null;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function callRow(call: GatewayCall, id: string, needle: string, raw: boolean, open: boolean): HTMLDetailsElement {
  const row = el("details", "call");
  row.dataset.call = id;

  const head = el("summary");
  head.title = `${call.method || call.via} ${call.url}\nStarted ${formatMs(call.startedAt)} after page load, via ${call.via}`;
  head.append(
    el("span", "call-method", call.method),
    callPath(call.url),
    callStatus(call),
    el("span", "call-time num quiet", call.duration == null ? "" : formatMs(call.duration)),
  );
  row.append(head);

  // Bodies can be large; build them the first time the row opens.
  const fill = () => {
    if (row.dataset.filled) return;
    row.dataset.filled = "1";
    row.append(callBody(call, needle, raw));
  };
  row.open = open;
  if (open) fill();
  row.addEventListener("toggle", fill);
  return row;
}

/** `tix-hotel-search/v2/search?q=bali`: the part after /ms-gateway/, service first. */
function callPath(url: string): HTMLElement {
  const u = new URL(url);
  const marker = "/ms-gateway/";
  const [service = "", ...rest] = u.pathname.slice(u.pathname.indexOf(marker) + marker.length).split("/");
  const path = el("span", "call-path");
  path.append(el("strong", "", service));
  if (rest.length) path.append(`/${rest.join("/")}`);
  if (u.search) path.append(el("span", "quiet", u.search));
  return path;
}

function callStatus(call: GatewayCall): HTMLElement {
  const cell = el("span", "call-status num");
  if (call.duration == null) {
    cell.append(el("span", "quiet", "Pending"));
    return cell;
  }
  if (call.unrecorded && !call.status) {
    cell.append(el("span", "quiet", "Done"));
    return cell;
  }
  const status = el("span", isFailed(call) ? "bad" : "", call.status ? String(call.status) : "Failed");
  status.title = call.error ?? `${call.status} ${call.statusText ?? ""}`.trim();
  cell.append(status);
  const code = envelopeCode(call.response);
  if (code) {
    const c = el("span", "call-code bad", code);
    c.title = "Response code";
    cell.append(c);
  }
  return cell;
}

function callBody(call: GatewayCall, needle: string, raw: boolean): HTMLElement {
  const body = el("div", "call-body");
  if (call.unrecorded) {
    body.append(
      emptyNote(
        "Not recorded, so there's no response to show. If this still happens after reloading the page, the page made the call in a way the extension can't see.",
      ),
    );
    const query = new URL(call.url).searchParams;
    if ([...query].length) body.append(callSection("Request", { query: Object.fromEntries(query) }, needle, raw, 2));
    return body;
  }
  if (call.error) body.append(el("div", "call-error", call.error));

  const response = el("section", "call-part");
  const head = el("div", "call-part-head");
  head.append(el("span", "call-part-name", "Response"));
  if (call.duration == null) {
    head.append(el("span", "quiet", "Waiting for the response…"));
    response.append(head);
  } else {
    const type = call.responseHeaders?.["content-type"]?.split(";")[0];
    head.append(el("span", "quiet", [type, call.size != null ? formatBytes(call.size) : ""].filter(Boolean).join(", ")));
    if (call.response != null) {
      const copy = el("button", "call-copy", "Copy");
      copy.type = "button";
      copy.title = "Copy the response";
      copy.addEventListener("click", () => {
        const value = call.response;
        navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value, null, 2));
        flash(copy);
      });
      head.append(copy);
    }
    response.append(head, payload(call.response, needle, raw, 2));
  }
  body.append(response);

  const u = new URL(call.url);
  const request: Record<string, unknown> = {};
  if (u.search) request.query = Object.fromEntries(u.searchParams);
  if (call.requestBody != null) request.body = call.requestBody;
  request.headers = call.requestHeaders;
  body.append(callSection("Request", request, needle, raw, 2));
  if (call.responseHeaders) body.append(callSection("Response headers", call.responseHeaders, needle, raw, 1));
  return body;
}

/** A closed section under the response; filtering opens it when the match is inside. */
function callSection(name: string, value: unknown, needle: string, raw: boolean, depth: number): HTMLElement {
  const section = el("details", "call-more");
  section.append(el("summary", "", name), payload(value, needle, raw, depth));
  section.open = !!needle && JSON.stringify(value).toLowerCase().includes(needle);
  return section;
}

function payload(value: unknown, needle: string, raw: boolean, depth: number): HTMLElement {
  const host = el("div", "call-payload");
  if (raw || typeof value === "string") {
    host.append(el("pre", "raw", typeof value === "string" ? value : JSON.stringify(value, null, 2)));
  } else if (value == null) {
    host.append(el("span", "quiet", "Empty"));
  } else {
    renderTree(host, value, { filter: needle, expandDepth: depth });
  }
  return host;
}

// ---------- dataLayer tab ----------

/** Built rows by entry, reused across re-renders so polling doesn't collapse what the user opened. */
const pushRows = new WeakMap<HTMLElement, Map<string, HTMLDetailsElement>>();
/** Where the list ended last render (`session:index`), so rows past it are marked as just pushed. */
const pushEnd = new WeakMap<HTMLElement, { session: number; end: number }>();
/** Events the user opened. Kept apart from the DOM so a filter opening groups doesn't stick. */
const openEvents = new WeakMap<HTMLElement, Set<string>>();

/**
 * dataLayer entries since the last Clear, grouped by event: one folded line per event with
 * how many times it was pushed, in the order each event first fired, so groups don't move
 * as pushes arrive. A group opens to its pushes in order; a push opens to its tree.
 * Clear hides everything so far, so the next pushes stand alone.
 */
function renderDataLayer(
  out: HTMLElement,
  layer: DataLayerResult,
  { filter, raw, onClear }: { filter: string; raw: boolean; onClear?: () => void },
): void {
  if (!layer.found) {
    pushRows.delete(out);
    pushEnd.delete(out);
    out.replaceChildren(
      emptyNote("This page has no window.dataLayer. It appears once Google Tag Manager or gtag.js loads, or the page pushes to it."),
    );
    return;
  }
  const needle = filter.trim().toLowerCase();
  const previous = pushRows.get(out) ?? new Map<string, HTMLDetailsElement>();
  const wasOpen = new Set([...previous.values()].filter((d) => d.open).map((d) => d.dataset.push));
  const next = new Map<string, HTMLDetailsElement>();
  const opened = openEvents.get(out) ?? new Set<string>();
  openEvents.set(out, opened);
  // Only pushes that arrive while the tab is showing count as new; the first read marks none.
  const last = pushEnd.get(out);
  const freshFrom = last?.session === layer.session ? last.end : Infinity;
  pushEnd.set(out, { session: layer.session, end: layer.start + layer.entries.length });

  const groups = new Map<string, { line: PushLine; rows: HTMLDetailsElement[]; fresh: boolean }>();
  let shown = 0;
  layer.entries.forEach((entry, i) => {
    const index = layer.start + i;
    const push = describePush(entry);
    const lineMatches = !needle || `${push.command} ${push.name} ${push.keys}`.toLowerCase().includes(needle);
    if (!lineMatches && !JSON.stringify(entry).toLowerCase().includes(needle)) return;
    // Like the tree: a matching event shows the whole entry; otherwise the match is opened up inside.
    const inner = lineMatches ? "" : needle;
    const id = `${layer.session}:${index}`;
    const key = [id, inner, raw].join("|");
    const row = previous.get(key) ?? pushRow(entry, push, index, id, inner, raw, wasOpen.has(id) || !!inner);
    next.set(key, row);
    shown++;

    const event = eventOf(push);
    const group = groups.get(event.key) ?? { line: event.line, rows: [], fresh: false };
    groups.set(event.key, group);
    group.rows.push(row);
    if (index >= freshFrom) {
      group.fresh = true;
      row.classList.add("fresh");
    }
  });
  pushRows.set(out, next);

  const list = el("div", "calls");
  for (const [key, { line, rows, fresh }] of groups) {
    list.append(eventGroup(key, line, rows, { open: !!needle || opened.has(key), fresh, opened }));
  }
  if (!groups.size) {
    if (needle) list.append(emptyNote("No entries match the filter."));
    else if (layer.start) list.append(emptyNote("Nothing pushed since Clear. Use the page, and what it pushes lists here."));
    else list.append(emptyNote("window.dataLayer is empty."));
  }
  out.replaceChildren(dataLayerSummary(layer, shown, groups.size, !!needle, onClear), list);
}

function dataLayerSummary(
  layer: DataLayerResult,
  shown: number,
  events: number,
  filtered: boolean,
  onClear?: () => void,
): HTMLElement {
  const line = el("div", "summary");
  const total = layer.entries.length;
  const count = `${total} ${total === 1 ? "entry" : "entries"}`;
  line.append(el("span", "route", filtered ? `${shown} of ${count}` : count));
  if (events) line.append(el("span", "", plural(events, "event")));
  if (layer.start) {
    const cleared = el("span", "", `${layer.start} cleared`);
    cleared.title = "Hidden by Clear. They're still in window.dataLayer; reload the page to see them again.";
    line.append(cleared);
  }
  if (onClear) {
    const clear = el("button", "call-copy summary-action", "Clear");
    clear.type = "button";
    clear.title = "Hide the entries so far, so only new pushes show. The page's dataLayer isn't changed.";
    clear.disabled = !total;
    clear.addEventListener("click", onClear);
    line.append(clear);
  }
  return line;
}

interface PushLine {
  /** The gtag command when the entry is a gtag() call, e.g. `event` or `config`. */
  command: string;
  /** The event name, gtag target (`add_to_cart`, `G-XXXX`), or empty when the entry has none. */
  name: string;
  /** Google Tag Manager's own events (gtm.js, gtm.click, …), drawn quieter than the page's. */
  builtin: boolean;
  /** The entry's other keys, for a glance at what it carries. */
  keys: string;
}

function describePush(entry: unknown): PushLine {
  // gtag("event", "purchase", {...}) arrives as ["event", "purchase", {...}].
  if (Array.isArray(entry)) {
    const [command, target, params] = entry;
    const keys = params !== null && typeof params === "object" ? Object.keys(params).join(", ") : "";
    // gtag("js", new Date()) carries a timestamp, not a name.
    if (typeof target === "string" && command !== "js") return { command: String(command), name: target, builtin: false, keys };
    return { command: "", name: typeof command === "string" ? command : "gtag()", builtin: false, keys };
  }
  if (entry !== null && typeof entry === "object") {
    const { event, ...rest } = entry as Record<string, unknown>;
    const name = typeof event === "string" ? event : "";
    return { command: "", name, builtin: name.startsWith("gtm."), keys: Object.keys(rest).join(", ") };
  }
  return { command: "", name: "", builtin: false, keys: JSON.stringify(entry) };
}

/**
 * The group a push belongs to. gtag("event", "add_to_cart") joins dataLayer.push({ event: "add_to_cart" }),
 * as GTM sees them as the same event; other gtag commands group by command and target (`config G-XXXX`).
 */
function eventOf(push: PushLine): { key: string; line: PushLine } {
  if (push.command === "event") return { key: push.name, line: { ...push, command: "" } };
  return { key: [push.command, push.name].filter(Boolean).join(" "), line: push };
}

/** The event as the group's headline: gtag command quiet, name bold, GTM's own events regular. */
function eventLabel(push: PushLine): HTMLElement {
  const label = el("span", "push-event");
  if (push.command) label.append(el("span", "quiet", `${push.command} `));
  if (push.name) label.append(el("strong", push.builtin ? "builtin" : "", push.name));
  else if (!push.command) label.append(el("span", "quiet", "No event"));
  label.title = push.builtin ? `${push.name}, built into Google Tag Manager` : label.textContent ?? "";
  return label;
}

function eventGroup(
  key: string,
  line: PushLine,
  rows: HTMLDetailsElement[],
  { open, fresh, opened }: { open: boolean; fresh: boolean; opened: Set<string> },
): HTMLDetailsElement {
  const group = el("details", "event-group");
  group.dataset.event = key;
  group.open = open;
  // An open group marks its new rows; a folded one marks itself, since its rows can't be seen.
  if (fresh && !open) group.classList.add("fresh");
  for (const row of rows) if (!open) row.classList.remove("fresh");

  const head = el("summary");
  head.append(eventLabel(line), el("span", "event-count num quiet", rows.length === 1 ? "1 push" : `${rows.length} pushes`));
  group.addEventListener("animationend", (e) => {
    if (e.target === head) group.classList.remove("fresh");
  });
  // Clicks (and Enter/Space) are the user's choice; a filter opening groups isn't remembered.
  head.addEventListener("click", () => {
    if (group.open) {
      opened.delete(key);
      return;
    }
    opened.add(key);
    // A lone push is what the user came for; skip the second click.
    if (rows.length === 1) rows[0]!.open = true;
  });
  group.append(head, ...rows);
  return group;
}

function pushRow(
  entry: unknown,
  push: PushLine,
  index: number,
  id: string,
  needle: string,
  raw: boolean,
  open: boolean,
): HTMLDetailsElement {
  const row = el("details", "call push");
  row.dataset.push = id;
  // The arrival mark plays once; re-renders move the row and would replay it.
  row.addEventListener("animationend", () => row.classList.remove("fresh"));

  const head = el("summary");
  const keys = el("span", "push-keys quiet", push.keys || "No other keys");
  keys.title = push.keys;
  head.append(el("span", "push-index num quiet", String(index)), keys);
  row.append(head);

  const fill = () => {
    if (row.dataset.filled) return;
    row.dataset.filled = "1";
    const body = el("div", "call-body");
    const path = `dataLayer[${index}]`;
    const top = el("div", "call-part-head");
    const copy = el("button", "call-copy", "Copy");
    copy.type = "button";
    copy.title = `Copy ${path} as JSON`;
    copy.addEventListener("click", () => {
      navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      flash(copy);
    });
    top.append(el("span", "call-part-name", path), el("span", "quiet"), copy);
    const host = el("div", "call-payload");
    if (raw || entry === null || typeof entry !== "object") host.append(el("pre", "raw", JSON.stringify(entry, null, 2)));
    else renderTree(host, entry, { filter: needle, expandDepth: 2, rootPath: path, hideRoot: true });
    body.append(top, host);
    row.append(body);
  };
  row.open = open;
  if (open) fill();
  row.addEventListener("toggle", fill);
  return row;
}
