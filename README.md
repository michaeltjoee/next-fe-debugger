# next-fe debugger

Chrome extension (Manifest V3, TypeScript) for inspecting `window.__NEXT_DATA__` on Next.js **Pages Router** sites.

## Features

- **Three tabs**, opening on **Version**:
  - **Version**: the service name and deployed version (e.g. `homepage-v4` `v4.5.0`), read from asset URLs shaped like `…/<service>/v4.5.0/_next/…` (script and link tags, plus resources loaded later). The build that `__NEXT_DATA__.assetPrefix` points at is the headline (click the version to copy it); under it, file counts for the service's build against assets from `…/shared-components/…` (remote), with a total. Each build's files are listed below in collapsed groups.
  - **Next Data** (`window.__NEXT_DATA__`) and **Core Data** (`window.__CORE_DATA__`), each opening with a one-line summary (route and how props were fetched for `__NEXT_DATA__`, then the size).
  - The data tabs have a filter, Copy, and a **⋯** menu; the Version tab has no toolbar.
- **DevTools panel** (`__NEXT_DATA__` tab): collapsible JSON tree, filter by key/value, copy, auto-reload on navigation. The ⋯ menu holds **Show raw JSON**, **Watch for changes** (polls every second for client-side mutations; a yellow dot on ⋯ shows it's on), **Log to console** and **Reload data**. Follows the DevTools light/dark theme.
- **Filtering expands matches**: every path to a match opens, and a matching key (e.g. `sessionData`) shows its whole subtree.
- **Click a key** to copy its JS path (e.g. `$.props.pageProps.hotel.rating`).
- **Popup**: the same tabs with filter and Copy, for the active browser tab.
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

Shared logic lives in `src/shared/` (`read-next-data.ts` is serialized and injected, so it must stay self-contained). `inspector.ts` defines the tabs and renders each tab's body (summary line included) for both surfaces; `tabs.ts` is the tab strip. `__CORE_DATA__` is read from `window` only (no script-tag fallback).

Fonts (Plus Jakarta Sans, JetBrains Mono) are bundled in `src/shared/fonts/` under the SIL Open Font License. Shared types (`NextData`, the `Window` augmentation, the badge message) are ambient in `src/global.d.ts`, because `content.ts` must not import anything: content scripts can't be ES modules.

Note: Next.js doesn't update `__NEXT_DATA__` on client-side route changes — it reflects the initial server render.
