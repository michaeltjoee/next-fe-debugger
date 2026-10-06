import { readNextData } from "../shared/read-next-data.js";
import { renderTree } from "../shared/json-tree.js";

const out = document.getElementById("out") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;
const filter = document.getElementById("filter") as HTMLInputElement;

let data: NextData | null = null;

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
    if (!result) throw new Error("script returned nothing");
    data = result.data;
    if (!data) {
      status.textContent = result.isAppRouter
        ? "No __NEXT_DATA__ — App Router page (uses self.__next_f)."
        : "No __NEXT_DATA__ on this page.";
      return;
    }
    status.textContent = `page ${data.page} · buildId ${data.buildId} · ${(result.bytes / 1024).toFixed(1)} KB`;
    render();
  } catch (err) {
    status.textContent = `Can't read this page: ${err instanceof Error ? err.message : err}`;
  }
}

function render(): void {
  if (data) renderTree(out, data, { filter: filter.value, expandDepth: 2 });
}

filter.addEventListener("input", render);
document.getElementById("copy")!.addEventListener("click", () => {
  if (data) navigator.clipboard.writeText(JSON.stringify(data, null, 2));
});

load();
