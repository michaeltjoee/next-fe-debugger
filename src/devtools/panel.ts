import { readNextData, type NextDataResult } from "../shared/read-next-data.js";
import { emptyNote } from "../shared/json-tree.js";
import {
  SOURCES,
  logExpression,
  renderBody,
  renderStatus,
  tabStubs,
  valueOf,
  type SourceId,
} from "../shared/inspector.js";
import { createTabStrip } from "../shared/tabs.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $<HTMLElement>("out");
const status = $<HTMLElement>("status");
const toolbar = $<HTMLDivElement>("toolbar");
const filter = $<HTMLInputElement>("filter");
const viewTree = $<HTMLButtonElement>("view-tree");
const viewRaw = $<HTMLButtonElement>("view-raw");
const copy = $<HTMLButtonElement>("copy");
const log = $<HTMLButtonElement>("log");

// Match the DevTools theme, which can differ from the OS one.
document.documentElement.dataset.theme =
  chrome.devtools.panels.themeName === "dark" ? "dark" : "light";

let current: NextDataResult | null = null;
let lastJson = "";
let active: SourceId = "version";
let raw = false;
let watchTimer: ReturnType<typeof setInterval> | undefined;

const tabs = createTabStrip($("tabs"), out, SOURCES, active, (id) => {
  active = id;
  render();
});

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
    const json = JSON.stringify([result.data, result.core, result.bundles]);
    if (quiet && json === lastJson) return;
    lastJson = json;
    current = result;
  } catch (err) {
    current = null;
    lastJson = "";
    toolbar.hidden = true;
    status.replaceChildren();
    out.replaceChildren(emptyNote(`Can't read this page: ${err}`));
    return;
  }
  toolbar.hidden = false;
  renderStatus(status, current);
  tabs.setStubs(tabStubs(current));
  render();
}

function render(): void {
  if (!current) return;
  copy.disabled = log.disabled = valueOf(current, active) == null;
  renderBody(out, current, active, { filter: filter.value, raw });
}

function setRaw(value: boolean): void {
  raw = value;
  viewTree.setAttribute("aria-pressed", String(!raw));
  viewRaw.setAttribute("aria-pressed", String(raw));
  render();
}

filter.addEventListener("input", render);
viewTree.addEventListener("click", () => setRaw(false));
viewRaw.addEventListener("click", () => setRaw(true));

copy.addEventListener("click", async () => {
  const value = current && valueOf(current, active);
  if (value == null) return;
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
  copy.textContent = "Copied";
  setTimeout(() => (copy.textContent = "Copy"), 1200);
});

log.addEventListener("click", () => {
  if (current) evalInPage(logExpression(current, active));
});

$<HTMLInputElement>("watch").addEventListener("change", (e) => {
  clearInterval(watchTimer);
  if ((e.target as HTMLInputElement).checked) {
    watchTimer = setInterval(() => load({ quiet: true }), 1000);
  }
});

$("refresh").addEventListener("click", () => load());

// Full page navigations replace the document; re-read once it's loaded.
chrome.devtools.network.onNavigated.addListener(() => setTimeout(load, 300));

load();
