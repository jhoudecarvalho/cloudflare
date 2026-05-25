export type DashboardSummary = {
  totalZones: number;
  activeZones: number;
  totalRequests: number;
  totalCached: number;
  totalUncached: number;
  totalBandwidth: number;
  totalThreats: number;
  totalPageviews: number;
  totalUniques: number;
  periodDays: number;
};

export type TimeseriesPoint = {
  since: string;
  until: string;
  requests: number;
  bandwidth: number;
  threats: number;
  pageviews: number;
  uniques: number;
};

export type ZoneMetrics = {
  zoneId: string;
  name: string;
  status: string;
  plan?: string;
  requests: number;
  cached: number;
  uncached: number;
  bandwidth: number;
  threats: number;
  pageviews: number;
  uniques: number;
  dnsRecords?: number;
  sslStatus?: string;
  developmentMode?: string;
  error?: string;
};

export type ColoStat = {
  coloCode: string;
  requests: number;
  bandwidth: number;
  threats: number;
};

export type FirewallEvent = {
  action: string;
  source: string;
  country?: string;
  occurredAt: string;
};

export type DashboardOverview = {
  summary: DashboardSummary;
  timeseries: TimeseriesPoint[];
  topZones: ZoneMetrics[];
  zones: ZoneMetrics[];
  fetchedAt: string;
  warnings: string[];
};

export type ZoneDetail = {
  zone: ZoneMetrics;
  timeseries: TimeseriesPoint[];
  colos: ColoStat[];
  firewallEvents: FirewallEvent[];
  settings: Record<string, unknown>;
};
