export interface NextDataResult {
  url: string;
  source: "window" | "script-tag" | null;
  isAppRouter: boolean;
  bytes: number;
  data: NextData | null;
}

// Executed in the page's MAIN world (via inspectedWindow.eval or scripting.executeScript).
// Must be self-contained: it is serialized with Function.prototype.toString.
export function readNextData(): NextDataResult {
  const live = window.__NEXT_DATA__;
  const el = document.getElementById("__NEXT_DATA__");
  let fromScriptTag: NextData | null = null;
  if (el) {
    try {
      fromScriptTag = JSON.parse(el.textContent ?? "");
    } catch {}
  }
  const data = live ?? fromScriptTag;
  return {
    url: location.href,
    source: live ? "window" : fromScriptTag ? "script-tag" : null,
    // App Router pages have no __NEXT_DATA__; they stream RSC payload via self.__next_f.
    isAppRouter: !data && Array.isArray(self.__next_f),
    bytes: el ? (el.textContent ?? "").length : data ? JSON.stringify(data).length : 0,
    data: data ? JSON.parse(JSON.stringify(data)) : null,
  };
}
