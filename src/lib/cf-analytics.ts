import {
  cfGraphql,
  cfRequest,
  fetchAllZonesServer,
  mapPool,
} from "@/lib/cf-server";
import type {
  ColoStat,
  DashboardOverview,
  FirewallEvent,
  TimeseriesPoint,
  ZoneDetail,
  ZoneMetrics,
} from "@/lib/dashboard-types";

type AnalyticsTotals = {
  requests?: { all?: number; cached?: number; uncached?: number };
  bandwidth?: { all?: number; cached?: number; uncached?: number };
  threats?: { all?: number };
  pageviews?: { all?: number };
  uniques?: { all?: number };
};

type AnalyticsTimeseriesRow = {
  since: string;
  until: string;
  requests?: { all?: number };
  bandwidth?: { all?: number };
  threats?: { all?: number };
  pageviews?: { all?: number };
  uniques?: { all?: number };
};

type ZoneDashboard = {
  totals?: AnalyticsTotals;
  timeseries?: AnalyticsTimeseriesRow[];
};

function sinceDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function mergeTimeseries(rows: AnalyticsTimeseriesRow[]): TimeseriesPoint[] {
  const map = new Map<string, TimeseriesPoint>();

  for (const row of rows) {
    const key = row.since;
    const cur = map.get(key) ?? {
      since: row.since,
      until: row.until,
      requests: 0,
      bandwidth: 0,
      threats: 0,
      pageviews: 0,
      uniques: 0,
    };
    cur.requests += row.requests?.all ?? 0;
    cur.bandwidth += row.bandwidth?.all ?? 0;
    cur.threats += row.threats?.all ?? 0;
    cur.pageviews += row.pageviews?.all ?? 0;
    cur.uniques += row.uniques?.all ?? 0;
    map.set(key, cur);
  }

  return [...map.values()].sort(
    (a, b) => new Date(a.since).getTime() - new Date(b.since).getTime()
  );
}

async function fetchZoneAnalytics(
  token: string,
  zoneId: string,
  days: number
): Promise<ZoneDashboard | null> {
  try {
    const d = await cfRequest<ZoneDashboard>(
      token,
      `/zones/${zoneId}/analytics/dashboard?since=-${days}d&continuous=false`
    );
    if (!d.success) return null;
    return d.result;
  } catch {
    return null;
  }
}

async function fetchZoneDnsCount(token: string, zoneId: string): Promise<number> {
  try {
    const d = await cfRequest<unknown[]>(
      token,
      `/zones/${zoneId}/dns_records?per_page=1`
    );
    return d.result_info?.total_count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchSslStatus(token: string, zoneId: string): Promise<string> {
  try {
    const d = await cfRequest<{ enabled?: boolean; certificate_status?: string }>(
      token,
      `/zones/${zoneId}/ssl/universal/settings`
    );
    if (!d.success) return "—";
    if (d.result?.certificate_status) return d.result.certificate_status;
    return d.result?.enabled ? "ativo" : "inativo";
  } catch {
    return "—";
  }
}

async function buildZoneMetrics(
  token: string,
  zone: {
    id: string;
    name: string;
    status: string;
    plan?: { name: string };
    development_mode?: number;
  },
  days: number,
  includeExtras: boolean
): Promise<{ metrics: ZoneMetrics; timeseries: AnalyticsTimeseriesRow[] }> {
  const analytics = await fetchZoneAnalytics(token, zone.id, days);
  const totals = analytics?.totals;

  let dnsRecords: number | undefined;
  let sslStatus: string | undefined;

  if (includeExtras) {
    [dnsRecords, sslStatus] = await Promise.all([
      fetchZoneDnsCount(token, zone.id),
      fetchSslStatus(token, zone.id),
    ]);
  }

  const metrics: ZoneMetrics = {
    zoneId: zone.id,
    name: zone.name,
    status: zone.status,
    plan: zone.plan?.name,
    requests: totals?.requests?.all ?? 0,
    cached: totals?.requests?.cached ?? 0,
    uncached: totals?.requests?.uncached ?? 0,
    bandwidth: totals?.bandwidth?.all ?? 0,
    threats: totals?.threats?.all ?? 0,
    pageviews: totals?.pageviews?.all ?? 0,
    uniques: totals?.uniques?.all ?? 0,
    dnsRecords,
    sslStatus,
    developmentMode:
      zone.development_mode === 1
        ? "on"
        : zone.development_mode === 0
          ? "off"
          : undefined,
    error: analytics ? undefined : "Analytics indisponível para esta zona",
  };

  return {
    metrics,
    timeseries: analytics?.timeseries ?? [],
  };
}

async function tryAccountGraphqlTimeseries(
  token: string,
  accountId: string,
  days: number
): Promise<TimeseriesPoint[] | null> {
  const since = sinceDate(days);
  const query = `
    query AccountSeries($accountTag: string!, $since: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $since }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { requests bytes threats pageViews }
            uniq { uniques }
          }
        }
      }
    }
  `;

  try {
    type GqlData = {
      viewer: {
        accounts: {
          httpRequests1dGroups: {
            dimensions: { date: string };
            sum: {
              requests: number;
              bytes: number;
              threats: number;
              pageViews: number;
            };
            uniq: { uniques: number };
          }[];
        }[];
      };
    };

    const data = await cfGraphql<GqlData>(token, query, {
      accountTag: accountId,
      since,
    });

    const groups = data.viewer?.accounts?.[0]?.httpRequests1dGroups ?? [];
    if (!groups.length) return null;

    return groups.map((g) => ({
      since: g.dimensions.date,
      until: g.dimensions.date,
      requests: g.sum.requests ?? 0,
      bandwidth: g.sum.bytes ?? 0,
      threats: g.sum.threats ?? 0,
      pageviews: g.sum.pageViews ?? 0,
      uniques: g.uniq.uniques ?? 0,
    }));
  } catch {
    return null;
  }
}

export async function buildDashboardOverview(
  token: string,
  accountId: string,
  days = 7
): Promise<DashboardOverview> {
  const warnings: string[] = [];
  const zonesRaw = await fetchAllZonesServer(token);

  const results = await mapPool(zonesRaw, 6, (z) =>
    buildZoneMetrics(token, z, days, true)
  );

  const zoneMetrics = results.map((r) => r.metrics);
  const allTimeseriesRows = results.flatMap((r) => r.timeseries);

  let timeseries =
    (await tryAccountGraphqlTimeseries(token, accountId, days)) ??
    mergeTimeseries(allTimeseriesRows);

  if (!timeseries.length && allTimeseriesRows.length) {
    timeseries = mergeTimeseries(allTimeseriesRows);
  }

  const withErrors = zoneMetrics.filter((z) => z.error);
  if (withErrors.length) {
    warnings.push(
      `${withErrors.length} zona(s) sem analytics (plano ou permissão).`
    );
  }

  const summary = {
    totalZones: zoneMetrics.length,
    activeZones: zoneMetrics.filter((z) => z.status === "active").length,
    totalRequests: zoneMetrics.reduce((s, z) => s + z.requests, 0),
    totalCached: zoneMetrics.reduce((s, z) => s + z.cached, 0),
    totalUncached: zoneMetrics.reduce((s, z) => s + z.uncached, 0),
    totalBandwidth: zoneMetrics.reduce((s, z) => s + z.bandwidth, 0),
    totalThreats: zoneMetrics.reduce((s, z) => s + z.threats, 0),
    totalPageviews: zoneMetrics.reduce((s, z) => s + z.pageviews, 0),
    totalUniques: zoneMetrics.reduce((s, z) => s + z.uniques, 0),
    periodDays: days,
  };

  const topZones = [...zoneMetrics]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 50);

  return {
    summary,
    timeseries,
    topZones,
    zones: zoneMetrics,
    fetchedAt: new Date().toISOString(),
    warnings,
  };
}

export async function buildZoneDetail(
  token: string,
  zoneId: string,
  days = 7
): Promise<ZoneDetail | null> {
  const z = await cfRequest<{
    id: string;
    name: string;
    status: string;
    plan?: { name: string };
    development_mode?: number;
  }>(token, `/zones/${zoneId}`);

  if (!z.success || !z.result) return null;

  const { metrics, timeseries } = await buildZoneMetrics(
    token,
    z.result,
    days,
    true
  );

  let colos: ColoStat[] = [];
  try {
    const c = await cfRequest<
      {
        colo_id: number;
        colo_code: string;
        requests: { all: number };
        bandwidth: { all: number };
        threats: { all: number };
      }[]
    >(token, `/zones/${zoneId}/analytics/colos?since=-${days}d`);
    if (c.success && Array.isArray(c.result)) {
      colos = c.result
        .map((row) => ({
          coloCode: row.colo_code,
          requests: row.requests?.all ?? 0,
          bandwidth: row.bandwidth?.all ?? 0,
          threats: row.threats?.all ?? 0,
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 20);
    }
  } catch {
    /* optional */
  }

  let firewallEvents: FirewallEvent[] = [];
  try {
    const f = await cfRequest<
      {
        action: string;
        source?: { ip?: string };
        country?: string;
        occurred_at: string;
      }[]
    >(token, `/zones/${zoneId}/firewall/events?per_page=25`);
    if (f.success && Array.isArray(f.result)) {
      firewallEvents = f.result.map((e) => ({
        action: e.action,
        source: e.source?.ip ?? "—",
        country: e.country,
        occurredAt: e.occurred_at,
      }));
    }
  } catch {
    /* optional */
  }

  let settings: Record<string, unknown> = {};
  try {
    const s = await cfRequest<Record<string, unknown>>(
      token,
      `/zones/${zoneId}/settings`
    );
    if (s.success && s.result) {
      const r = s.result as Record<string, { value?: unknown }>;
      settings = {
        ssl: r.ssl?.value,
        security_level: r.security_level?.value,
        min_tls_version: r.min_tls_version?.value,
        always_use_https: r.always_use_https?.value,
        browser_cache_ttl: r.browser_cache_ttl?.value,
        development_mode: r.development_mode?.value,
      };
    }
  } catch {
    /* optional */
  }

  return {
    zone: metrics,
    timeseries: mergeTimeseries(timeseries),
    colos,
    firewallEvents,
    settings,
  };
}

