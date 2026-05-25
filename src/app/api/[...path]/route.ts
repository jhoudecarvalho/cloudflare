import { NextRequest } from "next/server";
import { CF_CORS, proxyToCloudflare } from "@/lib/cloudflare";
import { getSessionCredentials } from "@/lib/session";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CF_CORS });
  }

  const creds = await getSessionCredentials();
  const authHeader = creds
    ? `Bearer ${creds.token}`
    : req.headers.get("authorization");

  if (!authHeader) {
    return Response.json(
      { success: false, errors: [{ message: "Não autenticado" }] },
      { status: 401, headers: CF_CORS }
    );
  }

  const { path } = await ctx.params;
  const cfPath = "/" + path.join("/");
  const search = req.nextUrl.search;
  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.text()
      : undefined;

  try {
    return await proxyToCloudflare(
      req.method,
      `${cfPath}${search}`,
      authHeader,
      body
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro no proxy";
    return Response.json(
      { success: false, errors: [{ message }] },
      { status: 502, headers: CF_CORS }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
