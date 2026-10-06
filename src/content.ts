// Runs in the isolated world, so it can't see window.__NEXT_DATA__ directly,
// but Next.js also serializes it into <script id="__NEXT_DATA__">, which we can read.
// Not an ES module (content scripts can't be), so no imports/exports here.
(() => {
  const el = document.getElementById("__NEXT_DATA__");
  let page: string | undefined;
  if (el) {
    try {
      page = (JSON.parse(el.textContent ?? "") as NextData).page;
    } catch {}
  }
  const msg: NextDataDetectedMessage = { type: "next-data-detected", found: !!el, page };
  chrome.runtime.sendMessage(msg);
})();
