# next-fe debugger

Chrome extension (Manifest V3, TypeScript) for inspecting `window.__NEXT_DATA__` on Next.js **Pages Router** sites.

## Features

- **Three tabs**, opening on **Version**:
  - **Version**: the service name and deployed version (e.g. `homepage-v4` `v4.5.0`), read from asset URLs shaped like `…/<service>/v4.5.0/_next/…` (script and link tags, plus resources loaded later). The build that `__NEXT_DATA__.assetPrefix` points at is the headline; other versioned builds on the page (e.g. remote modules) are listed under it.
  - **`__NEXT_DATA__`** and **`window.__CORE_DATA__`**, each with its size.
  - Filter, Copy, JSON view and Log act on the active tab.
- **DevTools panel** (`__NEXT_DATA__` tab): collapsible JSON tree, filter by key/value, raw JSON view, copy, `console.log` in page, auto-reload on navigation, and a **Watch** mode that polls every second for client-side mutations. Follows the DevTools light/dark theme.
- **Filtering expands matches**: every path to a match opens, and a matching key (e.g. `sessionData`) shows its whole subtree.
- **Click a key** to copy its JS path (e.g. `$.props.pageProps.hotel.rating`).
- **Popup**: quick tree + summary (page, buildId, how props were fetched, payload size) for the active tab.
- **Badge**: toolbar icon shows `N` on pages that ship a `<script id="__NEXT_DATA__">`.
- Detects **App Router** pages (no `__NEXT_DATA__`, uses `self.__next_f`) and says so.

## Build

```bash
npm install
npm run build     # tsc → dist/, then copies HTML/CSS alongside
npm run watch     # recompile on change
npm run typecheck
```

`manifest.json` points into `dist/`, so build before loading.

## Install (unpacked)

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this folder (the repo root, not `dist/`).
4. Open a Next.js page → DevTools → **`__NEXT_DATA__`** tab (or click the toolbar icon).

After editing code, rebuild (or keep `npm run watch` running), hit the reload ↻ button on the extension card, then close/reopen DevTools.

## Local test page

```bash
python3 -m http.server -d test 8080
```

Then visit http://localhost:8080/fixture.html.

## How it works

| Piece | World | Reads |
| --- | --- | --- |
| `src/content.ts` | isolated | `<script id="__NEXT_DATA__">` text → tells background to set badge |
| `src/devtools/panel.ts` | page (via `inspectedWindow.eval`) | live `window.__NEXT_DATA__`, falls back to script tag |
| `src/popup/popup.ts` | page (via `scripting.executeScript({ world: "MAIN" })`) | same as panel |

Shared logic lives in `src/shared/` (`read-next-data.ts` is serialized and injected, so it must stay self-contained). `inspector.ts` defines the tabs and renders the summary row and the tab body for both surfaces; `tabs.ts` is the tab strip. `__CORE_DATA__` is read from `window` only (no script-tag fallback).

Fonts (Plus Jakarta Sans, JetBrains Mono) are bundled in `src/shared/fonts/` under the SIL Open Font License. Shared types (`NextData`, the `Window` augmentation, the badge message) are ambient in `src/global.d.ts`, because `content.ts` must not import anything: content scripts can't be ES modules.

Note: Next.js doesn't update `__NEXT_DATA__` on client-side route changes — it reflects the initial server render.
