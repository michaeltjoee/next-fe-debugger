import { clearDataLayer, readNextData, type NextDataResult } from "../shared/read-next-data.js";
import { emptyNote } from "../shared/json-tree.js";
import {
  SOURCES,
  hasToolbar,
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

let current: NextDataResult | null = null;
let active: SourceId = sourceOf(new URLSearchParams(location.search).get("tab")) ?? "version";

const selectTab = createTabStrip($("tabs"), out, SOURCES, active, (id) => {
  active = id;
  render();
});

// The keyboard shortcuts (see background.ts) open the popup as popup.html?tab=<id>; while it's
// open, the same shortcuts switch tabs here.
function sourceOf(id: string | null): SourceId | undefined {
  return SOURCES.find((s) => s.id === id)?.id;
}

chrome.commands.onCommand.addListener((command) => {
  const id = command.startsWith("open-") && sourceOf(command.slice("open-".length));
  if (id) selectTab(id);
});

async function activeTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error("no active tab");
  return tab.id;
}

async function load(): Promise<void> {
  try {
    const tabId = await activeTabId();
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readNextData,
    });
    const result = injection?.result;
    if (!result) throw new Error("the page returned nothing");
    current = result;
    render();
  } catch (err) {
    out.replaceChildren(
      emptyNote(`Can't read this page: ${err instanceof Error ? err.message : err}`),
    );
  }
}

function render(): void {
  if (!current) return;
  toolbar.hidden = !hasToolbar(active);
  copy.disabled = valueOf(current, active) == null;
  renderBody(out, current, active, { filter: filter.value, raw: false, onClear });
}

async function onClear(): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId: await activeTabId() }, world: "MAIN", func: clearDataLayer });
  } catch {}
  load();
}

filter.addEventListener("input", render);
copy.addEventListener("click", async () => {
  const value = current && valueOf(current, active);
  if (value == null) return;
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
  copy.textContent = "Copied";
  setTimeout(() => (copy.textContent = "Copy"), 1200);
});

load();
