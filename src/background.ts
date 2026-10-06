// Shows a badge on tabs whose page ships a __NEXT_DATA__ script tag.
chrome.runtime.onMessage.addListener(
  (msg: NextDataDetectedMessage | undefined, sender: chrome.runtime.MessageSender) => {
    const tabId = sender.tab?.id;
    if (msg?.type !== "next-data-detected" || !tabId) return;
    chrome.action.setBadgeText({ tabId, text: msg.found ? "N" : "" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#111" });
    chrome.action.setTitle({
      tabId,
      title: msg.found
        ? `__NEXT_DATA__ found (${msg.page ?? "?"})`
        : "No __NEXT_DATA__ on this page",
    });
  },
);
