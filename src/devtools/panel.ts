import { gatewayStamp, readNextData, type NextDataResult } from "../shared/read-next-data.js";
import { emptyNote } from "../shared/json-tree.js";
import {
  SOURCES,
  hasToolbar,
  logExpression,
  renderBody,
  valueOf,
  type SourceId,
} from "../shared/inspector.js";
import { createTabStrip } from "../shared/tabs.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $<HTMLElement>("out");
const toolbar = $<HTMLDivElement>("toolbar");
const filter = $<HTMLInputElement>("filter");
const copy = $<HTMLButtonElement>("copy");
const more = $<HTMLButtonElement>("more");
const menu = $<HTMLDivElement>("menu");
const rawItem = $<HTMLButtonElement>("raw");
const watchItem = $<HTMLButtonElement>("watch");

// Match the DevTools theme, which can differ from the OS one.
document.documentElement.dataset.theme =
  chrome.devtools.panels.themeName === "dark" ? "dark" : "light";

let current: NextDataResult | null = null;
let lastJson = "";
let active: SourceId = "version";
let raw = false;
let watchTimer: ReturnType<typeof setInterval> | undefined;

createTabStrip($("tabs"), out, SOURCES, active, (id) => {
  active = id;
  render();
  if (id === "gateway") load({ quiet: true });
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
    const json = JSON.stringify([
      result.data,
      result.core,
      result.bundles,
      result.shared,
      result.gateway.session,
      result.gateway.stamp,
    ]);
    if (quiet && json === lastJson) return;
    lastJson = json;
    current = result;
  } catch (err) {
    current = null;
    lastJson = "";
    toolbar.hidden = true;
    out.replaceChildren(emptyNote(`Can't read this page: ${err}`));
    return;
  }
  render();
}

function render(): void {
  if (!current) return;
  toolbar.hidden = !hasToolbar(active);
  copy.disabled = valueOf(current, active) == null;
  renderBody(out, current, active, { filter: filter.value, raw });
}

/** Menu toggles: flip the item's check and return the new state. */
function toggle(item: HTMLButtonElement): boolean {
  const on = item.getAttribute("aria-checked") !== "true";
  item.setAttribute("aria-checked", String(on));
  return on;
}

filter.addEventListener("input", render);

copy.addEventListener("click", async () => {
  const value = current && valueOf(current, active);
  if (value == null) return;
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
  copy.textContent = "Copied";
  setTimeout(() => (copy.textContent = "Copy"), 1200);
});

// Open the menu under the ⋯ button, right edges aligned, and focus its first item.
menu.addEventListener("beforetoggle", (e) => {
  if ((e as ToggleEvent).newState !== "open") return;
  const r = more.getBoundingClientRect();
  menu.style.top = `${r.bottom + 4}px`;
  menu.style.right = `${document.documentElement.clientWidth - r.right}px`;
});
menu.addEventListener("toggle", (e) => {
  more.setAttribute("aria-expanded", String((e as ToggleEvent).newState === "open"));
  if ((e as ToggleEvent).newState === "open") menu.querySelector("button")!.focus();
});
menu.addEventListener("keydown", (e) => {
  const items = [...menu.querySelectorAll("button")];
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  items[(next + items.length) % items.length]!.focus();
});

rawItem.addEventListener("click", () => {
  raw = toggle(rawItem);
  render();
});

watchItem.addEventListener("click", () => {
  const on = toggle(watchItem);
  more.classList.toggle("watching", on);
  more.title = on ? "More actions (watching for changes)" : "More actions";
  clearInterval(watchTimer);
  if (on) watchTimer = setInterval(() => load({ quiet: true }), 1000);
});

$("log").addEventListener("click", () => {
  menu.hidePopover();
  if (current) evalInPage(logExpression(current, active));
});

$("refresh").addEventListener("click", () => {
  menu.hidePopover();
  load();
});

// Gateway calls arrive while the page runs, so that tab follows them. Polls a cheap
// stamp, and reads the calls themselves only when it moves.
setInterval(async () => {
  if (active !== "gateway" || !current) return;
  const stamp = await evalInPage<string>(`(${gatewayStamp.toString()})()`).catch(() => null);
  if (stamp !== null && stamp !== current.gateway.stamp) load({ quiet: true });
}, 1000);

// Full page navigations replace the document; re-read once it's loaded.
chrome.devtools.network.onNavigated.addListener(() => setTimeout(load, 300));

load();
