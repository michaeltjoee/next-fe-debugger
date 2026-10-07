# TIX-FE-DEBUGGER

Chrome extension (Manifest V3, TypeScript) for inspecting `window.__NEXT_DATA__` on Next.js **Pages Router** sites.

## Features

- **Four tabs**, opening on **Version**:
  - **Version**: the service name and deployed version (e.g. `homepage-v4` `v4.5.0`), read from asset URLs shaped like `…/<service>/v4.5.0/_next/…` (script and link tags, plus resources loaded later). The build that `__NEXT_DATA__.assetPrefix` points at is printed on a boarding pass (click the version to copy it); its stub has file counts for the service's build against assets from `…/shared-components/…` (remote), with a total. Each build's files are listed below in collapsed groups.
  - **API Fetch**: every call the page makes from the browser to `…/ms-gateway/…` (fetch and XHR), in order: status, method, path (service first), a timing bar showing when it ran against the other calls (like the Network panel's waterfall), and time. Open a call for its response as a tree (with Copy and **Copy as cURL**), then its request (query, body, headers) and response headers. Copy as cURL has the headers the page set and only six cookies (`session_access_token`, `device_id`, `userlang`, `tiket_currency`, `country_code`, `cf_clearance`), read by the background with `chrome.cookies` so the HttpOnly ones are included. Failed calls (HTTP 4xx/5xx or no response) have a red status and edge, and a response `code` other than `SUCCESS` shows under the status. In the DevTools panel the list updates as calls happen. Calls the extension didn't record (e.g. the page was open before the extension loaded) still show, from the browser's resource timing, marked not recorded and without bodies. Calls made on the server during SSR aren't visible. **Clear** hides the calls so far (recorded or not) so only new calls show, as on dataLayer; the ignored-path counts restart with it, and a page reload starts over.
  - **Page Data**: `window.__NEXT_DATA__` and `window.__CORE_DATA__` in one scroll, each in its own section whose head (name, size, Copy) stays pinned while its tree scrolls. `__NEXT_DATA__` opens with its route and how props were fetched, with `props.pageProps` already open. A global the page doesn't have says so in its section. Sections fold, and stay folded across re-reads.
  - **dataLayer**: `window.dataLayer` (Google Tag Manager / gtag.js) grouped by event, one folded line per event with how many times it was pushed, in the order each event first fired. `gtag("event", "add_to_cart")` joins `dataLayer.push({ event: "add_to_cart" })`; other gtag calls group by command (e.g. `config G-XXXX`), and entries without an event under **No event**. GTM's own `gtm.*` events are drawn lighter than the page's. Open a group for its pushes in order (index and keys), and a push for its tree, with Copy; clicking a key copies its path (e.g. `dataLayer[12].ecommerce.items`). DOM elements (like GTM's `gtm.element`) show as `[button#push]`. In the DevTools panel the list updates as the page pushes, and new pushes get a yellow mark that fades (on the group, while it's folded). The filter opens the groups it matches. **Clear** hides the entries so far so only new pushes show; it marks the clear point on the page's array without changing its entries, so GTM and the page don't notice, and a page reload shows everything again.
  - The data tabs have a filter, Copy, and a **⋯** menu; the Version tab has no toolbar. On API Fetch the filter matches URLs, then bodies and headers, opening each match. On Page Data one filter searches both globals; the toolbar's Copy copies both, keyed by name.
- **DevTools panel** (`TIX-FE-DEBUGGER` tab): collapsible JSON tree, filter by key/value, copy, auto-reload on navigation. The ⋯ menu holds **Show raw JSON**, **Watch for changes** (polls every second for client-side mutations; a yellow dot on ⋯ shows it's on), **Log to console** and **Reload data**. Follows the DevTools light/dark theme.
- **Filtering expands matches**: every path to a match opens, and a matching key (e.g. `sessionData`) shows its whole subtree.
- **Click a key** to copy its JS path (e.g. `__NEXT_DATA__.props.pageProps.hotel.rating` on Page Data, so it pastes straight into the console).
- **Popup**: the same tabs with filter and Copy, for the active browser tab. Keyboard shortcuts open it straight on a tab (or switch tabs while it's open): **Alt+Shift+D** Version, **Alt+Shift+F** API Fetch, **Alt+Shift+G** Page Data, **Alt+Shift+H** dataLayer (**⌥⇧** on Mac). Change them at `chrome://extensions/shortcuts`. Needs Chrome 127+ (for `chrome.action.openPopup`).
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
4. Open a Next.js page → DevTools → **`TIX-FE-DEBUGGER`** tab (or click the toolbar icon).

After editing code, rebuild (or keep `npm run watch` running), hit the reload ↻ button on the extension card, then close/reopen DevTools.

## Local test page

```bash
python3 -m http.server -d test 8080
```

Then visit http://localhost:8080/fixture.html. It also calls ms-gateway endpoints served from `test/ms-gateway/` (plus a 404 and a POST the server rejects), for the API Fetch tab.

## How it works

| Piece | World | Reads |
| --- | --- | --- |
| `src/gateway-hook.ts` | page, at `document_start` | wraps `fetch`/`XMLHttpRequest` and records `…/ms-gateway/…` calls into `window.__MS_GATEWAY__` (last 300, bodies over 1 MB not kept) |
| `src/content.ts` | isolated | `<script id="__NEXT_DATA__">` text → tells background to set badge |
| `src/devtools/panel.ts` | page (via `inspectedWindow.eval`) | live `window.__NEXT_DATA__`, falls back to script tag |
| `src/popup/popup.ts` | page (via `scripting.executeScript({ world: "MAIN" })`) | same as panel |

Shared logic lives in `src/shared/` (`read-next-data.ts` is serialized and injected, so it must stay self-contained). `inspector.ts` defines the tabs and renders each tab's body for both surfaces; `tabs.ts` is the tab strip. `__CORE_DATA__` is read from `window` only (no script-tag fallback).

Fonts (Plus Jakarta Sans, JetBrains Mono) are bundled in `src/shared/fonts/` under the SIL Open Font License. Shared types (`NextData`, the `Window` augmentation, the badge message) are ambient in `src/global.d.ts`, because `content.ts` must not import anything: content scripts can't be ES modules.

Note: Next.js doesn't update `__NEXT_DATA__` on client-side route changes — it reflects the initial server render.
