// Swaps the toolbar icon per tab: slate ticket when idle, tiket blue/yellow when the page ships __NEXT_DATA__.
const ICONS = {
  active: { 16: "/icons/icon16.png", 32: "/icons/icon32.png" },
  idle: { 16: "/icons/idle16.png", 32: "/icons/idle32.png" },
};

chrome.runtime.onMessage.addListener(
  (msg: NextDataDetectedMessage | undefined, sender: chrome.runtime.MessageSender) => {
    const tabId = sender.tab?.id;
    if (msg?.type !== "next-data-detected" || !tabId) return;
    chrome.action.setIcon({ tabId, path: msg.found ? ICONS.active : ICONS.idle });
    chrome.action.setTitle({
      tabId,
      title: msg.found
        ? `TIX-FE-DEBUGGER: __NEXT_DATA__ found (${msg.page ?? "?"})`
        : "TIX-FE-DEBUGGER: no __NEXT_DATA__ on this page",
    });
  },
);

// Shortcuts (manifest "commands", named "open-<tab>") open the popup on that tab: point this
// tab's popup at popup.html?tab=<id> just for this opening, then put it back. If the popup is
// already open, openPopup fails and the popup switches tabs itself.
const POPUP = "dist/popup/popup.html";

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!command.startsWith("open-")) return;
  const tabId = tab?.id;
  try {
    await chrome.action.setPopup({ tabId, popup: `${POPUP}?tab=${command.slice("open-".length)}` });
    await chrome.action.openPopup();
  } catch {
  } finally {
    chrome.action.setPopup({ tabId, popup: POPUP });
  }
});
