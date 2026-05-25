import type { CfApiResponse, CfDnsRecord, CfZone } from "@/lib/types";

const API = "/api";

export async function cfGet<T>(path: string): Promise<CfApiResponse<T>> {
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 100)}`);
  }
  return r.json();
}

export async function cfPatch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<CfApiResponse<T>> {
  const r = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function fetchAllZones(): Promise<CfZone[]> {
  let pg = 1;
  const all: CfZone[] = [];
  while (true) {
    const d = await cfGet<CfZone[]>(`/zones?per_page=50&page=${pg}`);
    if (!d.success) throw new Error(d.errors?.[0]?.message || "Erro ao buscar zonas");
    all.push(...d.result);
    if (!d.result_info || pg >= d.result_info.total_pages) break;
    pg++;
  }
  return all;
}

export async function fetchDns(zoneId: string): Promise<CfDnsRecord[]> {
  let pg = 1;
  const all: CfDnsRecord[] = [];
  while (true) {
    const d = await cfGet<CfDnsRecord[]>(
      `/zones/${zoneId}/dns_records?per_page=100&page=${pg}`
    );
    if (!d.success) throw new Error(d.errors?.[0]?.message || "Erro");
    all.push(...d.result);
    if (!d.result_info || pg >= d.result_info.total_pages) break;
    pg++;
  }
  return all;
}

export async function logBulkAudit(payload: {
  oldIp: string;
  newIp: string;
  scope: string;
  total: number;
  success: number;
  failed: number;
  details: unknown;
}) {
  await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "bulk_ip_change", ...payload }),
  }).catch(() => {});
}
