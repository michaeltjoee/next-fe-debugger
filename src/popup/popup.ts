import { readNextData, type NextDataResult } from "../shared/read-next-data.js";
import { emptyNote } from "../shared/json-tree.js";
import {
  SOURCES,
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
const copy = $<HTMLButtonElement>("copy");

let current: NextDataResult | null = null;
let active: SourceId = "version";

const tabs = createTabStrip($("tabs"), out, SOURCES, active, (id) => {
  active = id;
  render();
});

async function load(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    if (tab?.id == null) throw new Error("no active tab");
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readNextData,
    });
    const result = injection?.result;
    if (!result) throw new Error("the page returned nothing");
    current = result;
    toolbar.hidden = false;
    renderStatus(status, result);
    tabs.setStubs(tabStubs(result));
    render();
  } catch (err) {
    out.replaceChildren(
      emptyNote(`Can't read this page: ${err instanceof Error ? err.message : err}`),
    );
  }
}

function render(): void {
  if (!current) return;
  copy.disabled = valueOf(current, active) == null;
  renderBody(out, current, active, { filter: filter.value, raw: false });
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
