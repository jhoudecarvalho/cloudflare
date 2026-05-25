import { NextRequest, NextResponse } from "next/server";
import { buildZoneDetail } from "@/lib/cf-analytics";
import { getSessionCredentials } from "@/lib/session";

type RouteContext = { params: Promise<{ zoneId: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const creds = await getSessionCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { zoneId } = await ctx.params;
  const days = Math.min(
    30,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "7", 10))
  );

  try {
    const data = await buildZoneDetail(creds.token, zoneId, days);
    if (!data) {
      return NextResponse.json({ error: "Zona não encontrada" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar zona";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
