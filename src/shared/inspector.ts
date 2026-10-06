// What both the panel and the popup show: the deployed version and one tab per
// page global, each with a one-line summary above its data.
import type { AssetBundle, NextDataResult } from "./read-next-data.js";
import { emptyNote, flash, renderTree } from "./json-tree.js";

export type SourceId = "version" | "next" | "core";

export const SOURCES: readonly { id: SourceId; label: string }[] = [
  { id: "version", label: "Version" },
  { id: "next", label: "Next Data" },
  { id: "core", label: "Core Data" },
];

/** The active tab's value, or null when the page doesn't have it. */
export function valueOf(result: NextDataResult, id: SourceId): unknown {
  if (id === "version") {
    const { bundles, shared } = result;
    return bundles.length || shared.length ? { bundles, shared } : null;
  }
  if (id === "next") return result.data;
  return result.core.found && !result.core.error ? result.core.data : null;
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
  return id === "next"
    ? `console.log("__NEXT_DATA__", window.__NEXT_DATA__ ?? JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent ?? "null"))`
    : `console.log("__CORE_DATA__", window.__CORE_DATA__)`;
}

export function renderBody(
  out: HTMLElement,
  result: NextDataResult,
  id: SourceId,
  { filter, raw }: { filter: string; raw: boolean },
): void {
  const value = valueOf(result, id);
  if (value == null) {
    out.replaceChildren(emptyNote(missingMessage(result, id)));
    return;
  }
  if (id === "version") {
    renderVersion(out, result);
    return;
  }
  const body = document.createElement("div");
  if (raw) {
    const pre = document.createElement("pre");
    pre.className = "raw";
    pre.textContent = JSON.stringify(value, null, 2);
    body.append(pre);
  } else {
    renderTree(body, value, { filter, expandDepth: 2 });
  }
  out.replaceChildren(summary(result, id, value), body);
}

/**
 * One quiet line above the data: the route and how it got its props for __NEXT_DATA__,
 * then the size. Unusual facts (fallback, read from the script tag) only show when true.
 */
function summary(result: NextDataResult, id: SourceId, value: unknown): HTMLElement {
  const el = document.createElement("div");
  el.className = "summary";
  const span = (text: string, className = "", title = "") => {
    const s = document.createElement("span");
    s.className = className;
    s.textContent = text;
    if (title) s.title = title;
    return s;
  };
  const data = result.data;
  if (id === "next" && data) {
    const mode = data.gssp
      ? "getServerSideProps"
      : data.gip
        ? "getInitialProps"
        : data.nextExport
          ? "Static export"
          : "Static";
    el.append(
      span(data.page, "route", `Page route, build ${data.buildId}`),
      span(mode, "", "How the page got its props"),
    );
    if (data.isFallback) el.append(span("Fallback page", "", "isFallback is true"));
    if (result.source === "script-tag") {
      el.append(span("Read from the script tag", "", "window.__NEXT_DATA__ is missing"));
    }
  }
  el.append(span(formatBytes(JSON.stringify(value).length), "", "Size as JSON"));
  return el;
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

function missingMessage(result: NextDataResult, id: SourceId): string {
  if (id === "version") {
    return "No versioned or shared-component assets on this page. Looked for URLs shaped like …/<service>/v4.5.0/_next/… or …/shared-components/….";
  }
  if (id === "core") {
    return result.core.error
      ? `window.__CORE_DATA__ exists but can't be shown as JSON: ${result.core.error}`
      : "No window.__CORE_DATA__ on this page.";
  }
  return result.isAppRouter
    ? "No __NEXT_DATA__ on this page. It looks like an App Router page, which streams its data through self.__next_f instead."
    : "No __NEXT_DATA__ on this page. Open a Next.js Pages Router page, then refresh.";
}
