import { NextRequest, NextResponse } from "next/server";
import { buildDashboardOverview } from "@/lib/cf-analytics";
import { getSessionCredentials } from "@/lib/session";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const creds = await getSessionCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const days = Math.min(
    30,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "7", 10))
  );

  try {
    const data = await buildDashboardOverview(
      creds.token,
      creds.accountId,
      days
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
