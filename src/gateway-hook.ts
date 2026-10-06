// Records the page's own fetch/XHR calls to …/ms-gateway/… so the API Fetch tab can show them.
// Runs in the MAIN world at document_start, before the page's scripts, so it sees every
// browser-side call from page load on. Not an ES module (content scripts can't be).
(() => {
  if (window.__MS_GATEWAY__) return;

  const MAX_CALLS = 300;
  const MAX_BODY_CHARS = 1_000_000;
  // Gateway paths that poll in the background and would only crowd the list.
  // Also copied into readGateway in shared/read-next-data.ts, which lists them in the tab; keep them in sync.
  const IGNORED_PATHS = [
    "tix-inbox/userInbox/unreadCount",
    "tix-chat-platform/v1/users/unread_count",
  ];

  const log: GatewayLog = { session: performance.timeOrigin, version: 0, calls: [] };
  // Non-enumerable, so it stays out of anything that walks window's keys.
  Object.defineProperty(window, "__MS_GATEWAY__", { value: log, configurable: true });

  let nextId = 1;
  const changed = () => log.version++;

  function gatewayUrl(raw: string | URL): string | null {
    try {
      const url = new URL(raw, location.href);
      if (!url.pathname.includes("/ms-gateway/")) return null;
      if (IGNORED_PATHS.some((p) => url.pathname.includes(p))) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  /** JSON when it parses, else the text itself; huge bodies are summarised, not kept. */
  function parseBody(text: string): unknown {
    if (!text) return null;
    if (text.length > MAX_BODY_CHARS) return `[${(text.length / 1024 / 1024).toFixed(1)} MB body not kept]`;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  function requestBody(body: unknown): unknown {
    if (body == null) return null;
    if (typeof body === "string") return parseBody(body);
    if (body instanceof URLSearchParams) return Object.fromEntries(body);
    if (body instanceof FormData) {
      return Object.fromEntries(
        [...body].map(([k, v]) => [k, typeof v === "string" ? v : `[File ${v.name}]`]),
      );
    }
    return `[${Object.prototype.toString.call(body).slice(8, -1)} body]`;
  }

  function start(via: GatewayCall["via"], method: string, url: string, headers: Record<string, string>, body: unknown): GatewayCall {
    const call: GatewayCall = {
      id: nextId++,
      via,
      method: method.toUpperCase(),
      url,
      startedAt: performance.now(),
      requestHeaders: headers,
      requestBody: body,
    };
    log.calls.push(call);
    if (log.calls.length > MAX_CALLS) log.calls.shift();
    changed();
    return call;
  }

  function finish(call: GatewayCall, fields: Partial<GatewayCall>): void {
    Object.assign(call, fields, { duration: performance.now() - call.startedAt });
    changed();
  }

  // ---------- fetch ----------

  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const isRequest = input instanceof Request;
    const url = gatewayUrl(isRequest ? input.url : input);
    if (!url) return origFetch.call(this, input, init);

    let call: GatewayCall;
    try {
      const headers: Record<string, string> = {};
      new Headers(init?.headers ?? (isRequest ? input.headers : undefined)).forEach((v, k) => (headers[k] = v));
      const method = init?.method ?? (isRequest ? input.method : "GET");
      call = start("fetch", method, url, headers, requestBody(init?.body));
      if (isRequest && init?.body == null && input.body) {
        input.clone().text().then((text) => {
          call.requestBody = parseBody(text);
          changed();
        }, () => {});
      }
    } catch {
      return origFetch.call(this, input, init);
    }

    const pending = origFetch.call(this, input, init);
    pending.then(
      (res) => {
        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => (responseHeaders[k] = v));
        const head = { status: res.status, statusText: res.statusText, responseHeaders };
        res.clone().text().then(
          (text) => finish(call, { ...head, response: parseBody(text), size: text.length }),
          (err) => finish(call, { ...head, error: `Couldn't read the body: ${err}` }),
        );
      },
      (err) => finish(call, { status: 0, error: String(err) }),
    );
    return pending;
  };

  // ---------- XMLHttpRequest ----------

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  const origSetHeader = XHR.setRequestHeader;
  const opened = new WeakMap<XMLHttpRequest, { method: string; url: string; headers: Record<string, string> }>();

  XHR.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
    const gateway = gatewayUrl(url);
    if (gateway) opened.set(this, { method, url: gateway, headers: {} });
    else opened.delete(this);
    return origOpen.apply(this, arguments as unknown as Parameters<typeof origOpen>);
  } as typeof XHR.open;

  XHR.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const o = opened.get(this);
    if (o) o.headers[name.toLowerCase()] = value;
    return origSetHeader.call(this, name, value);
  };

  XHR.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const o = opened.get(this);
    if (o) {
      const call = start("xhr", o.method, o.url, o.headers, requestBody(body));
      let failure = "";
      this.addEventListener("error", () => (failure = "Network error"));
      this.addEventListener("abort", () => (failure = "Aborted"));
      this.addEventListener("timeout", () => (failure = "Timed out"));
      this.addEventListener("loadend", () => {
        const responseHeaders: Record<string, string> = {};
        for (const line of this.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
          const i = line.indexOf(":");
          if (i > 0) responseHeaders[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
        }
        let response: unknown = null;
        let size: number | undefined;
        try {
          if (this.responseType === "" || this.responseType === "text") {
            response = parseBody(this.responseText);
            size = this.responseText.length;
          } else if (this.responseType === "json") {
            response = this.response;
            size = JSON.stringify(response)?.length;
          } else {
            response = `[${this.responseType} response]`;
          }
        } catch {}
        finish(call, {
          status: this.status,
          statusText: this.statusText,
          responseHeaders,
          response,
          size,
          ...(failure ? { error: failure } : {}),
        });
      });
    }
    return origSend.call(this, body);
  };
})();
