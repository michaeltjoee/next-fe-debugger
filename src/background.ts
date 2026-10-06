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
        ? `next-fe debugger: __NEXT_DATA__ found (${msg.page ?? "?"})`
        : "next-fe debugger: no __NEXT_DATA__ on this page",
    });
  },
);
