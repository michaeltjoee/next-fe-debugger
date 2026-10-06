// Tab strip. The active tab is drawn by one paper-coloured "marker" that slides
// between tabs and joins the tab to the content below, like a folder tab.
// Returns a function that selects a tab, as if it were clicked.
export function createTabStrip<Id extends string>(
  container: HTMLElement,
  panel: HTMLElement,
  specs: readonly { id: Id; label: string }[],
  initial: Id,
  onSelect: (id: Id) => void,
): (id: Id) => void {
  const marker = document.createElement("div");
  marker.className = "marker";
  marker.setAttribute("aria-hidden", "true");

  const strip = document.createElement("div");
  strip.className = "tabs";
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Page data");

  const tabs = specs.map(({ id, label }) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${id}`;
    tab.dataset.id = id;
    tab.textContent = label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    tab.addEventListener("click", () => select(id));
    return tab;
  });

  strip.append(marker, ...tabs);
  container.replaceChildren(strip);
  panel.setAttribute("role", "tabpanel");

  let active = initial;

  function place(): void {
    const tab = tabs.find((t) => t.dataset.id === active)!;
    marker.style.width = `${tab.offsetWidth}px`;
    marker.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function mark(focus = false): void {
    for (const tab of tabs) {
      const on = tab.dataset.id === active;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    panel.setAttribute("aria-labelledby", `tab-${active}`);
  }

  function select(id: Id, focus = false): void {
    active = id;
    mark(focus);
    place();
    onSelect(id);
  }

  strip.addEventListener("keydown", (e) => {
    const i = specs.findIndex((s) => s.id === active);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: specs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(specs[(next + specs.length) % specs.length]!.id, true);
  });

  // Widths change with fonts and window size; only animate once laid out.
  new ResizeObserver(place).observe(strip);
  document.fonts.ready.then(() => {
    place();
    requestAnimationFrame(() => strip.classList.add("ready"));
  });
  mark();
  return (id) => select(id);
}
