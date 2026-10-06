// Minimal collapsible JSON tree renderer with path copy + text filter.

type Key = string | number | null;

export interface RenderTreeOptions {
  filter?: string;
  expandDepth?: number;
}

export function renderTree(
  container: HTMLElement,
  value: unknown,
  { filter = "", expandDepth = 1 }: RenderTreeOptions = {},
): void {
  container.replaceChildren();
  const needle = filter.trim().toLowerCase();
  const node = buildNode(null, value, "$", 0, expandDepth, needle);
  if (node) container.append(node);
  else container.append(emptyNote(needle ? "No keys or values match the filter." : "Empty."));
}

export function emptyNote(text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  return div;
}

function isBranch(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function entriesOf(value: object): [Key, unknown][] {
  return Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
}

function keyMatches(key: Key, needle: string): boolean {
  return key != null && String(key).toLowerCase().includes(needle);
}

function matches(key: Key, value: unknown, needle: string): boolean {
  if (!needle || keyMatches(key, needle)) return true;
  if (!isBranch(value)) return String(value).toLowerCase().includes(needle);
  return entriesOf(value).some(([k, v]) => matches(k, v, needle));
}

function pathFor(parent: string, key: Key): string {
  if (key == null) return parent;
  return typeof key === "number" || !/^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}[${JSON.stringify(key)}]`
    : `${parent}.${key}`;
}

function buildNode(
  key: Key,
  value: unknown,
  path: string,
  depth: number,
  expandDepth: number,
  needle: string,
): HTMLDivElement | null {
  if (!matches(key, value, needle)) return null;

  const row = document.createElement("div");
  row.className = "row";

  const label = document.createElement("span");
  if (key != null) {
    label.className = "key";
    label.textContent = typeof key === "number" ? String(key) : JSON.stringify(key);
    label.title = `Click to copy path: ${path}`;
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(path);
      flash(label);
    });
  }

  if (!isBranch(value)) {
    row.classList.add("leaf");
    if (key != null) row.append(label, ": ");
    const v = document.createElement("span");
    v.className = `val ${value === null ? "null" : typeof value}`;
    v.textContent = JSON.stringify(value);
    row.append(v);
    return row;
  }

  const entries = entriesOf(value);
  const details = document.createElement("details");
  // Filtering opens the path to every match.
  details.open = depth < expandDepth || !!needle;
  // A key that matches shows its whole subtree, not just the parts that match again.
  const childNeedle = needle && keyMatches(key, needle) ? "" : needle;

  const summary = document.createElement("summary");
  if (key != null) summary.append(label, ": ");
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = Array.isArray(value) ? `Array(${entries.length})` : `{${entries.length}}`;
  summary.append(meta);
  details.append(summary);

  // Render children lazily so huge payloads stay responsive.
  const fill = () => {
    if (details.dataset.filled) return;
    details.dataset.filled = "1";
    const children = document.createElement("div");
    children.className = "children";
    for (const [k, v] of entries) {
      const child = buildNode(k, v, pathFor(path, k), depth + 1, expandDepth, childNeedle);
      if (child) children.append(child);
    }
    details.append(children);
  };
  if (details.open) fill();
  details.addEventListener("toggle", fill);

  row.append(details);
  return row;
}

function flash(el: HTMLElement): void {
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 600);
}
