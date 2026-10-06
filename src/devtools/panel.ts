import { readNextData, type NextDataResult } from "../shared/read-next-data.js";
import { renderTree } from "../shared/json-tree.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $<HTMLDivElement>("out");
const status = $<HTMLDivElement>("status");
const filter = $<HTMLInputElement>("filter");
const view = $<HTMLSelectElement>("view");

let current: NextDataResult | null = null;
let lastJson = "";
let watchTimer: ReturnType<typeof setInterval> | undefined;

function evalInPage<T>(expr: string): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval<T>(expr, (result, err) => {
      if (err) reject(err.value ?? err.description ?? err);
      else resolve(result as T);
    });
  });
}

async function load({ quiet = false } = {}): Promise<void> {
  try {
    const result = await evalInPage<NextDataResult>(`(${readNextData.toString()})()`);
    const json = JSON.stringify(result.data);
    if (quiet && json === lastJson) return;
    lastJson = json;
    current = result;
    render();
  } catch (err) {
    current = null;
    status.textContent = `Error: ${err}`;
    out.replaceChildren();
  }
}

function render(): void {
  if (!current?.data) {
    status.textContent = "";
    out.innerHTML = current?.isAppRouter
      ? `<div class="empty">No <code>__NEXT_DATA__</code>. This looks like an <b>App Router</b> page — data is streamed via <code>self.__next_f</code> (RSC payload) instead.</div>`
      : `<div class="empty">No <code>__NEXT_DATA__</code> found on this page.</div>`;
    return;
  }

  const { data, source, bytes } = current;
  status.innerHTML = [
    `page <b>${escape(data.page)}</b>`,
    `buildId <b>${escape(data.buildId)}</b>`,
    data.isFallback ? "<b>fallback</b>" : "",
    data.gssp ? "getServerSideProps" : "",
    data.gip ? "getInitialProps" : "",
    data.nextExport ? "static export" : "",
    `${(bytes / 1024).toFixed(1)} KB`,
    `from ${source === "window" ? "window" : "&lt;script&gt; tag"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (view.value === "raw") {
    const pre = document.createElement("pre");
    pre.className = "raw";
    pre.textContent = JSON.stringify(data, null, 2);
    out.replaceChildren(pre);
  } else {
    renderTree(out, data, { filter: filter.value, expandDepth: 2 });
  }
}

function escape(s: unknown): string {
  return String(s ?? "—").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

$("refresh").addEventListener("click", () => load());
filter.addEventListener("input", render);
view.addEventListener("change", render);
$("copy").addEventListener("click", () => {
  if (current?.data) navigator.clipboard.writeText(JSON.stringify(current.data, null, 2));
});
$("log").addEventListener("click", () =>
  evalInPage("console.log('__NEXT_DATA__', window.__NEXT_DATA__)"),
);
$<HTMLInputElement>("watch").addEventListener("change", (e) => {
  clearInterval(watchTimer);
  if ((e.target as HTMLInputElement).checked) {
    watchTimer = setInterval(() => load({ quiet: true }), 1000);
  }
});

// Full page navigations replace the document; re-read once it's loaded.
chrome.devtools.network.onNavigated.addListener(() => setTimeout(load, 300));

load();
