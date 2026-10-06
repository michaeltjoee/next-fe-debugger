// Tab strip. The active tab is drawn by one "ticket" element that slides
// between tabs; the yellow stub holds a short fact about the tab (version, size).
export interface TabStrip<Id extends string> {
  /** Text on each tab's yellow stub. */
  setStubs(stubs: Record<Id, string>): void;
}

export function createTabStrip<Id extends string>(
  container: HTMLElement,
  panel: HTMLElement,
  specs: readonly { id: Id; label: string }[],
  initial: Id,
  onSelect: (id: Id) => void,
): TabStrip<Id> {
  const ticket = document.createElement("div");
  ticket.className = "ticket";
  ticket.setAttribute("aria-hidden", "true");

  const strip = document.createElement("div");
  strip.className = "tabs";
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Page data");

  const tabs = specs.map(({ id, label }) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${id}`;
    tab.dataset.id = id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = label;
    const size = document.createElement("span");
    size.className = "tab-size";
    tab.append(name, size);
    tab.addEventListener("click", () => select(id));
    return tab;
  });

  strip.append(ticket, ...tabs);
  container.replaceChildren(strip);
  panel.setAttribute("role", "tabpanel");

  let active = initial;

  function place(): void {
    const tab = tabs.find((t) => t.dataset.id === active)!;
    const size = tab.querySelector<HTMLElement>(".tab-size")!;
    ticket.style.width = `${tab.offsetWidth}px`;
    ticket.style.transform = `translateX(${tab.offsetLeft}px)`;
    ticket.style.setProperty("--perf", `${size.offsetLeft}px`);
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

  // Widths change with sizes, fonts and window size; only animate once laid out.
  new ResizeObserver(place).observe(strip);
  document.fonts.ready.then(() => {
    place();
    requestAnimationFrame(() => strip.classList.add("ready"));
  });
  mark();

  return {
    setStubs(stubs) {
      for (const tab of tabs) {
        tab.querySelector(".tab-size")!.textContent = stubs[tab.dataset.id as Id];
      }
      place();
    },
  };
}
