// The extension's architecture map: manifest → five entrypoints → two sides (extension, page).
// Reusable across lessons. Put <figure class="map" data-extension-map data-highlight="badge"></figure>
// in a page; data-highlight dims everything except one flow. Flows:
//   badge  content.js → background.js        (runtime.sendMessage)
//   popup  popup.js → MAIN world             (scripting.executeScript)
//   panel  panel.js → MAIN world             (inspectedWindow.eval)
//   hook   gateway-hook.js inside MAIN world (wraps fetch / XHR)
// Omit data-highlight to show everything at full strength.

(() => {
  const NODES = {
    sw: { x: 26, y: 124, w: 298, h: 80, side: "ext", lines: [
      ["title", "background.js"],
      ["desc", "service worker · wakes on events, no DOM"],
      ["key", "manifest: background.service_worker"],
    ] },
    popup: { x: 26, y: 222, w: 298, h: 100, side: "ext", lines: [
      ["title", "popup/popup.js"],
      ["desc", "extension page · toolbar icon or shortcut"],
      ["key", "manifest: action.default_popup"],
      ["call", "→ scripting.executeScript(readPage)"],
    ] },
    panel: { x: 26, y: 340, w: 298, h: 100, side: "ext", lines: [
      ["title", "devtools.js → panel.js"],
      ["desc", "extension page inside DevTools"],
      ["key", "manifest: devtools_page"],
      ["call", "→ inspectedWindow.eval(readPage)"],
    ] },
    content: { x: 436, y: 124, w: 298, h: 100, side: "page", lines: [
      ["title", "content.js"],
      ["desc", "isolated world · document_idle"],
      ["key", "manifest: content_scripts[0]"],
      ["call", "→ runtime.sendMessage({ found })"],
    ] },
    main: { x: 436, y: 242, w: 298, h: 198, side: "page", lines: [
      ["title", "MAIN world (the page's own JS)"],
      ["desc", "gateway-hook.js · document_start"],
      ["key", "manifest: content_scripts[1], world: MAIN"],
      ["rule"],
      ["var", "window.__NEXT_DATA__, __CORE_DATA__"],
      ["var", "window.dataLayer"],
      ["var", "window.fetch, XHR  ← wrapped by hook"],
      ["var", "window.__MS_GATEWAY__  ← hook's log"],
    ] },
  };

  const FLOWS = {
    badge: { nodes: ["content", "sw"], from: [436, 174], to: [326, 164], side: "page" },
    popup: { nodes: ["popup", "main"], from: [324, 292], to: [434, 292], side: "ext" },
    panel: { nodes: ["panel", "main"], from: [324, 410], to: [434, 410], side: "ext" },
    hook: { nodes: ["main"] },
  };

  const LINE = {
    title: { dy: 22, cls: "t-title" },
    desc: { dy: 19, cls: "t-desc" },
    key: { dy: 17, cls: "t-key" },
    call: { dy: 21, cls: "t-call" },
    var: { dy: 19, cls: "t-var" },
    rule: { dy: 12 },
  };

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  function node(id, n, dim) {
    let y = n.y;
    const parts = [
      `<rect class="box box-${n.side}${dim ? " dim" : ""}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7"/>`,
    ];
    for (const [kind, text] of n.lines) {
      const l = LINE[kind];
      y += l.dy;
      if (kind === "rule") {
        parts.push(`<line class="divider" x1="${n.x + 12}" x2="${n.x + n.w - 12}" y1="${y - 4}" y2="${y - 4}"/>`);
        continue;
      }
      parts.push(`<text class="${l.cls} side-${n.side}" x="${n.x + 12}" y="${y}">${esc(text)}</text>`);
    }
    return `<g data-node="${id}" opacity="${dim ? 0.32 : 1}">${parts.join("")}</g>`;
  }

  function arrow(id, f, dim, on) {
    if (!f.from) return "";
    const [x1, y1] = f.from;
    const [x2, y2] = f.to;
    return `<line class="flow side-${f.side}${on ? " on" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#head-${f.side})" opacity="${dim ? 0.25 : 1}" data-flow="${id}"/>`;
  }

  function render(fig) {
    const hl = fig.dataset.highlight;
    const lit = hl && FLOWS[hl] ? new Set(FLOWS[hl].nodes) : null;
    const svg = `
<svg viewBox="0 0 760 470" role="img" aria-label="Architecture map: manifest.json declares five entrypoints across the extension side and the web page side">
  <style>
    .box { fill: var(--paper); stroke: var(--rule); stroke-width: 1.2; }
    .box-ext:not(.dim) { stroke: color-mix(in srgb, var(--accent) 45%, var(--rule)); }
    .box-page:not(.dim) { stroke: color-mix(in srgb, var(--accent-2) 45%, var(--rule)); }
    .region { fill: none; stroke-width: 1.2; stroke-dasharray: 5 4; }
    .region-ext { stroke: var(--accent); }
    .region-page { stroke: var(--accent-2); }
    .label { font: 600 10.5px var(--sans); letter-spacing: .09em; }
    .label-ext { fill: var(--accent); }
    .label-page { fill: var(--accent-2); }
    .t-title { font: 600 13px var(--mono); fill: var(--ink); }
    .t-desc { font: 11.5px var(--sans); fill: var(--ink); }
    .t-key, .t-var { font: 10.5px var(--mono); fill: var(--muted); }
    .t-var { fill: var(--ink); }
    .t-call { font: 600 10.5px var(--mono); }
    .t-call.side-ext { fill: var(--accent); }
    .t-call.side-page { fill: var(--accent-2); }
    .divider { stroke: var(--rule); }
    .flow { stroke-width: 1.6; }
    .flow.on { stroke-width: 2.6; }
    .flow.side-ext { stroke: var(--accent); }
    .flow.side-page { stroke: var(--accent-2); }
    .manifest { fill: var(--panel); stroke: var(--ink); stroke-width: 1.2; }
    .declares { stroke: var(--muted); stroke-width: 1.2; }
    .head-ext { fill: var(--accent); }
    .head-page { fill: var(--accent-2); }
    .head-muted { fill: var(--muted); }
  </style>
  <defs>
    <marker id="head-ext" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head-ext" d="M0 0 L10 5 L0 10 z"/></marker>
    <marker id="head-page" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head-page" d="M0 0 L10 5 L0 10 z"/></marker>
    <marker id="head-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="head-muted" d="M0 0 L10 5 L0 10 z"/></marker>
  </defs>

  <rect class="manifest" x="290" y="8" width="180" height="46" rx="7"/>
  <text class="t-title" x="380" y="29" text-anchor="middle">manifest.json</text>
  <text class="t-key" x="380" y="45" text-anchor="middle">Chrome reads this first</text>
  <line class="declares" x1="340" y1="54" x2="200" y2="86" marker-end="url(#head-muted)"/>
  <line class="declares" x1="420" y1="54" x2="560" y2="86" marker-end="url(#head-muted)"/>

  <rect class="region region-ext" x="10" y="88" width="330" height="370" rx="10"/>
  <text class="label label-ext" x="26" y="110">EXTENSION · chrome-extension://</text>
  <rect class="region region-page" x="420" y="88" width="330" height="370" rx="10"/>
  <text class="label label-page" x="436" y="110">WEB PAGE TAB · https://…</text>

  ${Object.entries(NODES).map(([id, n]) => node(id, n, lit && !lit.has(id))).join("")}
  ${Object.entries(FLOWS).map(([id, f]) => arrow(id, f, lit && hl !== id, hl === id)).join("")}
</svg>`;
    const wrap = document.createElement("div");
    wrap.className = "map-scroll";
    wrap.innerHTML = svg;
    fig.prepend(wrap);
  }

  for (const fig of document.querySelectorAll("[data-extension-map]")) render(fig);
})();
