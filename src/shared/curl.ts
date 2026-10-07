// "Copy as cURL" for a recorded API Fetch call, shaped like the Network panel's "Copy as cURL (bash)".
// Headers are the ones the page set (the browser's own, like user-agent, weren't recorded), and
// cookies are only the few the background keeps (see CURL_COOKIES in background.ts).

/** Single-quoted for bash and zsh; a ' inside becomes '\''. */
function quote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

/** The body as near as the hook kept it: text as is, a urlencoded form re-encoded, anything else as JSON. */
function bodyText(call: GatewayCall): string | null {
  const body = call.requestBody;
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (call.requestHeaders["content-type"]?.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(body as Record<string, string>).toString();
  }
  return JSON.stringify(body);
}

export async function curlCommand(call: GatewayCall): Promise<string> {
  const msg: CurlCookiesMessage = { type: "curl-cookies", url: call.url };
  const cookie = await chrome.runtime.sendMessage<CurlCookiesMessage, string>(msg).catch(() => "");
  const body = bodyText(call);
  const lines = [`curl ${quote(call.url)}`];
  // curl sends GET, or POST once there's a body; name the method only when it's neither.
  if (call.method !== (body == null ? "GET" : "POST")) lines.push(`-X ${quote(call.method)}`);
  for (const [name, value] of Object.entries(call.requestHeaders)) {
    if (name !== "cookie") lines.push(`-H ${quote(`${name}: ${value}`)}`);
  }
  if (cookie) lines.push(`-b ${quote(cookie)}`);
  if (body != null) lines.push(`--data-raw ${quote(body)}`);
  return lines.join(" \\\n  ");
}
