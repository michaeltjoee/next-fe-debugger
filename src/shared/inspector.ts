// What both the panel and the popup show: the deployed version, one tab per
// page global, the __NEXT_DATA__ summary row, and the body of the active tab.
import type { AssetBundle, NextDataResult } from "./read-next-data.js";
import { emptyNote, renderTree } from "./json-tree.js";

export type SourceId = "version" | "next" | "core";

export const SOURCES: readonly { id: SourceId; label: string }[] = [
  { id: "version", label: "Version" },
  { id: "next", label: "__NEXT_DATA__" },
  { id: "core", label: "__CORE_DATA__" },
];

/** The active tab's value, or null when the page doesn't have it. */
export function valueOf(result: NextDataResult, id: SourceId): unknown {
  if (id === "version") return result.bundles.length ? result.bundles : null;
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

/** Text on each tab's stub: the version, or the serialized size; "None" when missing. */
export function tabStubs(result: NextDataResult): Record<SourceId, string> {
  const size = (id: SourceId) => {
    const value = valueOf(result, id);
    return value == null ? "None" : formatBytes(JSON.stringify(value).length);
  };
  return {
    version: primaryBundle(result)?.version ?? "None",
    next: size("next"),
    core: size("core"),
  };
}

/** Page expression that logs the active tab; __NEXT_DATA__ falls back to the script tag like readNextData does. */
export function logExpression(result: NextDataResult, id: SourceId): string {
  if (id === "version") return `console.log("Asset versions", ${JSON.stringify(result.bundles)})`;
  return id === "next"
    ? `console.log("__NEXT_DATA__", window.__NEXT_DATA__ ?? JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent ?? "null"))`
    : `console.log("__CORE_DATA__", window.__CORE_DATA__)`;
}

export function renderStatus(el: HTMLElement, result: NextDataResult): void {
  const data = result.data;
  if (!data) {
    el.replaceChildren();
    return;
  }
  const cell = (text: string, className = "", title = "") => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    if (title) span.title = title;
    return span;
  };
  const mode = data.gssp
    ? "getServerSideProps"
    : data.gip
      ? "getInitialProps"
      : data.nextExport
        ? "Static export"
        : "Static";
  el.replaceChildren(
    cell(data.page, "route", "Page route"),
    cell(data.buildId, "build", `Build ID: ${data.buildId}`),
    cell(mode, "", "How the page got its props"),
    ...(data.isFallback ? [cell("Fallback", "", "isFallback is true")] : []),
    cell(result.source === "window" ? "From window" : "From script tag", "", "Where __NEXT_DATA__ was read from"),
  );
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
  } else if (raw) {
    const pre = document.createElement("pre");
    pre.className = "raw";
    pre.textContent = JSON.stringify(value, null, 2);
    out.replaceChildren(pre);
  } else if (id === "version") {
    renderVersion(out, result, filter);
  } else {
    renderTree(out, value, { filter, expandDepth: 2 });
  }
}

/** Service and version as the headline, then every versioned build the page loaded assets from. */
function renderVersion(out: HTMLElement, result: NextDataResult, filter: string): void {
  const main = primaryBundle(result)!;
  const line = (className: string, text: string) => {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = text;
    return div;
  };
  const count = main.urls.length;
  const hero = document.createElement("section");
  hero.className = "version";
  hero.append(
    line("version-service", main.service || "(root)"),
    line("version-number", main.version),
    line("version-where", `Served from ${new URL(main.origin).host}, ${count} ${count === 1 ? "asset" : "assets"}`),
  );

  const others = result.bundles.filter((b) => b !== main);
  if (others.length) {
    const note = document.createElement("div");
    note.className = "version-others";
    note.textContent = `Also loaded: ${others.map((b) => `${b.service || "(root)"} ${b.version}`).join(", ")}`;
    hero.append(note);
  }

  // Keyed by build so the tree reads "homepage-v4 v4.5.0: Array(3)" rather than "0: {4}".
  const byBuild = Object.fromEntries(
    result.bundles.map((b) => [`${b.service || "(root)"} ${b.version}`, b.urls]),
  );
  const tree = document.createElement("div");
  renderTree(tree, byBuild, { filter, expandDepth: 1 });
  out.replaceChildren(hero, tree);
}

function missingMessage(result: NextDataResult, id: SourceId): string {
  if (id === "version") {
    return "No versioned assets on this page. Looked for script and stylesheet URLs shaped like …/<service>/v4.5.0/_next/….";
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
