# Chrome Extension (Manifest V3) Resources

## Knowledge

- [Chrome Docs: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
  Isolated worlds, `world: "MAIN"`, `run_at` timing, and which APIs content scripts may call ([capabilities](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#understand-content-script-capabilities)). Use for: `content.ts`, `gateway-hook.ts`, anything about "what can this script see?".
- [Chrome Docs: Hello World tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
  `manifest.json` as the root of an extension; loading unpacked; what needs a reload. Use for: entrypoints and the dev loop.
- [Chrome Docs: Extension service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
  Event-driven background script, no DOM, unloaded when idle. Use for: `background.ts`.
- [Chrome Docs: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
  `runtime.sendMessage` / `onMessage`. Use for: the content → background badge message.
- [Chrome Docs: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
  `executeScript({ func, world })`; the function "will be serialized … execution context will be lost". Use for: how the popup reads the page.
- [Chrome Docs: chrome.devtools.inspectedWindow](https://developer.chrome.com/docs/extensions/reference/api/devtools/inspectedWindow)
  `eval()` runs an expression in the inspected page; result must be JSON-compliant. Use for: how the DevTools panel reads the page.
- [Chrome Docs: Extend DevTools](https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools)
  `devtools_page` lifetime and `devtools.panels.create`. Use for: `devtools.ts` / `panel.ts`.
- [Chrome Docs: chrome.action](https://developer.chrome.com/docs/extensions/reference/api/action)
  Per-tab `setIcon` / `setPopup`, `openPopup` (Chrome 127+). Use for: badge and shortcuts.
- [Chrome Docs: chrome.commands](https://developer.chrome.com/docs/extensions/reference/api/commands)
  Manifest `commands`, `onCommand(command, tab)`, max four suggested keys. Use for: Alt+Shift shortcuts.
- [MDN: PerformanceResourceTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
  What the browser records about every loaded resource. Use for: Version tab and "not recorded" API calls.

## Wisdom (Communities)

- [chromium-extensions Google Group](https://groups.google.com/a/chromium.org/g/chromium-extensions)
  Official Chromium extensions forum; Chrome DevRel engineers answer here. Use for: MV3 behaviour questions the docs don't settle.
- [Stack Overflow: google-chrome-extension tag](https://stackoverflow.com/questions/tagged/google-chrome-extension)
  Large, well-moderated Q&A archive. Use for: "has anyone hit this before?" debugging.

## Gaps

- No official Next.js page documents `__NEXT_DATA__` as a public API; it's an implementation detail of the Pages Router. Treat the fixture (`test/fixture.html`) as the reference shape.
