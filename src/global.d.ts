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
  /** App-specific global, shown on the Page Data tab with __NEXT_DATA__. */
  __CORE_DATA__?: unknown;
  /** ms-gateway calls recorded by gateway-hook.ts; non-enumerable. */
  __MS_GATEWAY__?: GatewayLog;
}

/** One browser-side call to …/ms-gateway/…. Response fields arrive once it settles. */
interface GatewayCall {
  id: number;
  via: "fetch" | "xhr";
  method: string;
  url: string;
  /** performance.now() when the call started. */
  startedAt: number;
  requestHeaders: Record<string, string>;
  /** Parsed JSON when the body is JSON, else text; null when there's no body. */
  requestBody: unknown;
  /** 0 when the call never got a response. */
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  response?: unknown;
  /** Response length in characters. */
  size?: number;
  duration?: number;
  error?: string;
  /** Seen only in resource timing: no method, headers or bodies. */
  unrecorded?: true;
}

interface GatewayLog {
  /** performance.timeOrigin of the page that recorded the calls; ids restart per page. */
  session: number;
  /** Bumped on every new or settled call, so readers can poll cheaply. */
  version: number;
  calls: GatewayCall[];
}

interface NextDataDetectedMessage {
  type: "next-data-detected";
  found: boolean;
  page?: string;
}
