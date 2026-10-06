// Ambient (global) types. Kept out of modules because content scripts can't be
// ES modules: an `import type` would make tsc emit `export {}` and break them.

interface NextData {
  page: string;
  buildId: string;
  query?: Record<string, unknown>;
  props?: Record<string, unknown>;
  isFallback?: boolean;
  gssp?: boolean;
  gip?: boolean;
  nextExport?: boolean;
  [key: string]: unknown;
}

interface Window {
  __NEXT_DATA__?: NextData;
  /** App Router RSC payload chunks. */
  __next_f?: unknown[];
  /** App-specific global shown in the second tab. */
  __CORE_DATA__?: unknown;
}

interface NextDataDetectedMessage {
  type: "next-data-detected";
  found: boolean;
  page?: string;
}
