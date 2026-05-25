const CF_HOST = "api.cloudflare.com";

export const CF_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function proxyToCloudflare(
  method: string,
  path: string,
  authorization: string | null,
  body?: string
): Promise<Response> {
  const cfPath = path.startsWith("/client/v4")
    ? path
    : `/client/v4${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Host: CF_HOST,
  };
  if (authorization) headers.Authorization = authorization;
  if (body && body.length > 0) headers["Content-Length"] = String(Buffer.byteLength(body));

  const res = await fetch(`https://${CF_HOST}${cfPath}`, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" && body ? body : undefined,
  });

  const outHeaders = new Headers(CF_CORS);
  const ct = res.headers.get("content-type");
  if (ct) outHeaders.set("Content-Type", ct);

  return new Response(res.body, { status: res.status, headers: outHeaders });
}
