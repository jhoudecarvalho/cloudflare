"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBytes, formatNumber } from "@/lib/format";
import type { DashboardOverview, ZoneDetail, ZoneMetrics } from "@/lib/dashboard-types";

type Props = {
  accountId: string;
  onSelectZone?: (zoneId: string) => void;
};

export default function DashboardOverview({ accountId, onSelectZone }: Props) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ZoneDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"requests" | "bandwidth" | "threats">("requests");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/dashboard/overview?days=${days}`, {
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao carregar");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setData(null);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const openZone = async (zoneId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(`/api/dashboard/zone/${zoneId}?days=${days}`, {
        credentials: "include",
      });
      const j = await r.json();
      if (r.ok) setDetail(j);
    } catch {
      /* ignore */
    }
    setDetailLoading(false);
  };

  const sortedZones = data
    ? [...data.zones].sort((a, b) => b[sortBy] - a[sortBy])
    : [];

  const maxReq = Math.max(...(data?.timeseries.map((t) => t.requests) ?? [1]), 1);
  const maxBar = Math.max(...sortedZones.map((z) => z.requests), 1);

  if (loading && !data) {
    return (
      <div className="dash-loading">
        <span className="spinner" /> Carregando analytics da conta…
        <p className="hint">Isso pode levar alguns segundos com muitos domínios.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="err-box" style={{ display: "flex", margin: 24 }}>
        ✕ {error}
        <button className="btn-sm" style={{ marginLeft: 12 }} onClick={load}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div className="dash-wrap">
      <div className="dash-toolbar">
        <div>
          <h3 className="dash-title">Visão geral da conta</h3>
          <p className="dash-sub">Account ID: <span className="mono">{accountId}</span></p>
        </div>
        <div className="dash-toolbar-r">
          <label className="flbl" style={{ marginBottom: 0, marginRight: 8 }}>
            Período
          </label>
          <select
            className="dash-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Últimas 24h</option>
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <button className="btn-sm" onClick={load} disabled={loading}>
            {loading ? "…" : "Atualizar"}
          </button>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="wbx" style={{ marginBottom: 16 }}>
          {data.warnings.join(" ")}
        </div>
      )}

      <div className="kpi-grid">
        <Kpi label="Domínios" value={String(s.totalZones)} sub={`${s.activeZones} ativos`} color="var(--ac)" />
        <Kpi label="Requisições" value={formatNumber(s.totalRequests)} sub={`${days}d`} color="var(--bl)" />
        <Kpi label="Bandwidth" value={formatBytes(s.totalBandwidth)} sub={`${formatNumber(s.totalCached)} cache`} color="var(--tl)" />
        <Kpi label="Ameaças" value={formatNumber(s.totalThreats)} sub="bloqueadas" color="var(--rd)" />
        <Kpi label="Pageviews" value={formatNumber(s.totalPageviews)} sub={`${days}d`} color="var(--pr)" />
        <Kpi label="Únicos" value={formatNumber(s.totalUniques)} sub="visitantes" color="var(--gn)" />
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <h3>Tráfego por dia</h3>
          <p>Requisições HTTP agregadas (conta / zonas)</p>
          {data.timeseries.length === 0 ? (
            <p className="hint">Sem série temporal no período.</p>
          ) : (
            <div className="chart-bars">
              {data.timeseries.map((t) => (
                <div key={t.since} className="chart-col">
                  <div
                    className="chart-bar"
                    style={{ height: `${Math.max(4, (t.requests / maxReq) * 100)}%` }}
                    title={`${t.requests} req`}
                  />
                  <span className="chart-lbl">
                    {new Date(t.since).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Cache vs origem</h3>
          <p>Distribuição de requisições no período</p>
          <div className="cache-split">
            <div className="cache-bar">
              <div
                className="cache-fill cached"
                style={{
                  width: `${s.totalRequests ? (s.totalCached / s.totalRequests) * 100 : 0}%`,
                }}
              />
              <div
                className="cache-fill uncached"
                style={{
                  width: `${s.totalRequests ? (s.totalUncached / s.totalRequests) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="cache-legend">
              <span><i className="dot dok" /> Cache {formatNumber(s.totalCached)}</span>
              <span><i className="dot dof" style={{ background: "var(--ac)" }} /> Origem {formatNumber(s.totalUncached)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="dash-table-hd">
          <h3>Domínios — ranking por tráfego</h3>
          <div className="scrow">
            {(["requests", "bandwidth", "threats"] as const).map((k) => (
              <button
                key={k}
                className={`sc${sortBy === k ? " on" : ""}`}
                onClick={() => setSortBy(k)}
              >
                {k === "requests" ? "Requisições" : k === "bandwidth" ? "Bandwidth" : "Ameaças"}
              </button>
            ))}
          </div>
        </div>
        <table className="dtbl dash-tbl">
          <thead>
            <tr>
              <th>Domínio</th>
              <th>Plano</th>
              <th>Requisições</th>
              <th>Bandwidth</th>
              <th>Cache</th>
              <th>Ameaças</th>
              <th>Pageviews</th>
              <th>DNS</th>
              <th>SSL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedZones.map((z) => (
              <ZoneRow
                key={z.zoneId}
                z={z}
                maxBar={maxBar}
                sortBy={sortBy}
                onDetail={() => openZone(z.zoneId)}
                onDns={() => onSelectZone?.(z.zoneId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {(detail || detailLoading) && (
        <div
          className="confirm-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="confirm-modal dash-modal">
            {detailLoading && <span className="spinner" />}
            {detail && (
              <>
                <h3 style={{ marginBottom: 8 }}>{detail.zone.name}</h3>
                <p className="hint" style={{ marginBottom: 16 }}>
                  {detail.zone.plan} · {detail.zone.status} · SSL: {detail.zone.sslStatus}
                </p>
                <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
                  <Kpi label="Requisições" value={formatNumber(detail.zone.requests)} color="var(--bl)" />
                  <Kpi label="Bandwidth" value={formatBytes(detail.zone.bandwidth)} color="var(--tl)" />
                  <Kpi label="Ameaças" value={formatNumber(detail.zone.threats)} color="var(--rd)" />
                </div>
                {detail.colos.length > 0 && (
                  <>
                    <h4 className="flbl">Top regiões (colo)</h4>
                    <table className="dtbl" style={{ marginBottom: 16 }}>
                      <thead>
                        <tr>
                          <th>Colo</th>
                          <th>Requisições</th>
                          <th>Bandwidth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.colos.slice(0, 10).map((c) => (
                          <tr key={c.coloCode}>
                            <td className="mono">{c.coloCode}</td>
                            <td>{formatNumber(c.requests)}</td>
                            <td>{formatBytes(c.bandwidth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {detail.firewallEvents.length > 0 && (
                  <>
                    <h4 className="flbl">Eventos firewall (recentes)</h4>
                    <table className="dtbl" style={{ marginBottom: 16 }}>
                      <thead>
                        <tr>
                          <th>Ação</th>
                          <th>IP</th>
                          <th>País</th>
                          <th>Quando</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.firewallEvents.slice(0, 10).map((e, i) => (
                          <tr key={i}>
                            <td>{e.action}</td>
                            <td className="mono">{e.source}</td>
                            <td>{e.country ?? "—"}</td>
                            <td className="mono" style={{ fontSize: 11 }}>
                              {new Date(e.occurredAt).toLocaleString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {Object.keys(detail.settings).length > 0 && (
                  <>
                    <h4 className="flbl">Configurações</h4>
                    <pre className="dash-settings">{JSON.stringify(detail.settings, null, 2)}</pre>
                  </>
                )}
                <button className="bta sec" onClick={() => setDetail(null)}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <p className="hint" style={{ marginTop: 12, textAlign: "right" }}>
        Atualizado: {new Date(data.fetchedAt).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="kpi-card" style={{ borderColor: color + "33" }}>
      <span className="kpi-lbl">{label}</span>
      <span className="kpi-val" style={{ color }}>
        {value}
      </span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function ZoneRow({
  z,
  maxBar,
  sortBy,
  onDetail,
  onDns,
}: {
  z: ZoneMetrics;
  maxBar: number;
  sortBy: string;
  onDetail: () => void;
  onDns: () => void;
}) {
  const barVal = sortBy === "bandwidth" ? z.bandwidth : sortBy === "threats" ? z.threats : z.requests;
  const barPct = maxBar ? (barVal / maxBar) * 100 : 0;

  return (
    <tr>
      <td>
        <div className="zn">{z.name}</div>
        <div className="zone-mini-bar">
          <div className="zone-mini-fill" style={{ width: `${barPct}%` }} />
        </div>
      </td>
      <td className="mono" style={{ fontSize: 11 }}>{z.plan ?? "—"}</td>
      <td>{formatNumber(z.requests)}</td>
      <td className="mono">{formatBytes(z.bandwidth)}</td>
      <td className="mono">{formatNumber(z.cached)}</td>
      <td style={{ color: z.threats ? "var(--rd)" : undefined }}>{formatNumber(z.threats)}</td>
      <td>{formatNumber(z.pageviews)}</td>
      <td>{z.dnsRecords ?? "—"}</td>
      <td className="mono" style={{ fontSize: 11 }}>{z.sslStatus ?? "—"}</td>
      <td>
        <button className="btn-sm" onClick={onDetail} style={{ marginRight: 4 }}>
          Detalhes
        </button>
        <button className="btn-sm" onClick={onDns}>
          DNS
        </button>
      </td>
    </tr>
  );
}
