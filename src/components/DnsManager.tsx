"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cfPatch,
  fetchAllZones,
  fetchDns,
  logBulkAudit,
} from "@/lib/cf-client";
import DashboardOverview from "@/components/DashboardOverview";
import type { BulkAffected, CfDnsRecord, CfZone } from "@/lib/types";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function DnsManager() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [zones, setZones] = useState<CfZone[]>([]);
  const [selZone, setSelZone] = useState<CfZone | null>(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [dnsRec, setDnsRec] = useState<CfDnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);

  const [tab, setTab] = useState<"overview" | "dns" | "bulk">("overview");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [includeAAAA, setIncludeAAAA] = useState(false);
  const [oldIp, setOldIp] = useState("");
  const [newIp, setNewIp] = useState("");
  const [affected, setAffected] = useState<BulkAffected[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkSummary, setBulkSummary] = useState("");
  const [bulkDone, setBulkDone] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setAccountId(data.accountId || "");
          const z = await fetchAllZones();
          setZones(z);
          setAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
  }, []);

  const doLogin = async () => {
    if (!token.trim() || !accountId.trim()) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId: accountId.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Falha no login");

      const z = await fetchAllZones();
      setZones(z);
      setAuthenticated(true);
      setToken("");
    } catch (e) {
      setLoginError("✕ " + (e instanceof Error ? e.message : "Erro"));
    }
    setLoginBusy(false);
  };

  const doLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setAuthenticated(false);
    setZones([]);
    setSelZone(null);
    setDnsRec([]);
    setAffected([]);
    setAccountId("");
    setToken("");
  };

  const selectZone = useCallback(async (id: string) => {
    const z = zones.find((x) => x.id === id);
    if (!z) return;
    setSelZone(z);
    setTab("dns");
    setDnsLoading(true);
    setDnsRec([]);
    try {
      const recs = await fetchDns(id);
      setDnsRec(recs);
    } catch {
      setDnsRec([]);
    }
    setDnsLoading(false);
  }, [zones]);

  const filteredZones = zones.filter((z) =>
    z.name.toLowerCase().includes(zoneSearch.toLowerCase())
  );

  const doPreview = async () => {
    const old = oldIp.trim();
    if (!old) return;
    setPreviewBusy(true);
    setAffected([]);
    const types = includeAAAA ? ["A", "AAAA"] : ["A"];
    const zs = scope === "selected" && selZone ? [selZone] : zones;
    const aff: BulkAffected[] = [];

    for (const z of zs) {
      try {
        const recs = await fetchDns(z.id);
        recs
          .filter((r) => types.includes(r.type) && r.content === old)
          .forEach((r) => {
            aff.push({
              zoneId: z.id,
              zoneName: z.name,
              recordId: r.id,
              name: r.name,
              type: r.type,
              ip: r.content,
              status: "pending",
            });
          });
      } catch {
        /* ignore zone errors */
      }
    }

    setAffected(aff);
    setPreviewBusy(false);
    setBulkDone(false);
    setBulkSummary("");
    setBulkProgress(0);
  };

  const execBulk = async () => {
    const nw = newIp.trim();
    if (!nw || bulkRunning || affected.length === 0) return;
    setShowConfirm(false);
    setBulkRunning(true);
    setBulkDone(false);
    let ok = 0;
    let fail = 0;
    const updated = [...affected];

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      try {
        const res = await cfPatch(`/zones/${r.zoneId}/dns_records/${r.recordId}`, {
          content: nw,
        });
        updated[i].status = res.success ? "success" : "error";
        if (res.success) ok++;
        else fail++;
      } catch {
        updated[i].status = "error";
        fail++;
      }
      setBulkProgress(((i + 1) / updated.length) * 100);
      setAffected([...updated]);
      await new Promise((res) => setTimeout(res, 100));
    }

    setBulkRunning(false);
    setBulkDone(true);
    setBulkSummary(
      `✓ ${ok} atualizado${ok !== 1 ? "s" : ""}` +
        (fail ? ` · ✕ ${fail} erro${fail !== 1 ? "s" : ""}` : "")
    );

    await logBulkAudit({
      oldIp: oldIp.trim(),
      newIp: nw,
      scope,
      total: updated.length,
      success: ok,
      failed: fail,
      details: updated.map((r) => ({
        zone: r.zoneName,
        name: r.name,
        type: r.type,
        status: r.status,
      })),
    });

    if (selZone) {
      try {
        const recs = await fetchDns(selZone.id);
        setDnsRec(recs);
      } catch {
        /* ignore */
      }
    }
  };

  if (loadingSession) {
    return (
      <div className="login-screen">
        <span className="spinner" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <h1>
            Cloud<em>flare</em> Hub
          </h1>
          <p className="sub">
            Dashboard completo: analytics, tráfego, domínios, DNS e alterações em massa.
          </p>
          <label className="flbl">Account ID</label>
          <input
            className="tinp"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Ex: 488d771c2ba20022ee74e4fe78bbadec"
            autoComplete="off"
            style={{ marginBottom: 16 }}
          />
          <p className="hint" style={{ marginBottom: 20 }}>
            Encontre em: Cloudflare Dashboard → qualquer site → Overview → lado direito → <strong>Account ID</strong>.
          </p>
          <label className="flbl">API Token (cfat_)</label>
          <input
            className="tinp"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            placeholder="Cole seu Account API Token aqui..."
            autoComplete="off"
          />
          <p className="hint">
            Crie em: Cloudflare Dashboard → My Profile → API Tokens.
            <br />
            Permissões recomendadas: <strong>Analytics:Read</strong>, <strong>Zone:Read</strong>, <strong>DNS:Edit</strong>.
          </p>
          {loginError && <div className="err-box">{loginError}</div>}
          <button className="btn-main" onClick={doLogin} disabled={loginBusy}>
            {loginBusy ? (
              <>
                <span className="spinner" /> Conectando...
              </>
            ) : (
              "Conectar"
            )}
          </button>
        </div>
      </div>
    );
  }

  const zoneName = selZone?.name ?? "";
  const uniqueZones = new Set(affected.map((r) => r.zoneName)).size;

  return (
    <>
      <div className="dashboard vis">
        <div className="topbar">
          <div className="topbar-l">
            <h2>
              Cloud<em>flare</em> Hub
            </h2>
            <span className="cnt">
              {zones.length} domínio{zones.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button className="btn-sm" onClick={doLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>

        <div className="shell">
          <div className="sidebar">
            <div className="sidebar-hd">
              <h4>Domínios</h4>
              <div className="srch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  placeholder="Buscar domínio..."
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="zlist">
              {filteredZones.map((z) => {
                const sel = selZone?.id === z.id;
                const dc =
                  z.status === "active" ? "dok" : z.status === "pending" ? "dwt" : "dof";
                return (
                  <div
                    key={z.id}
                    className={`zi${sel ? " sel" : ""}`}
                    onClick={() => selectZone(z.id)}
                  >
                    <div className="zico">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                      </svg>
                    </div>
                    <div className="zinf">
                      <div className="zn">{z.name}</div>
                      <div className="zm">
                        <span className={`dot ${dc}`} />
                        {z.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="main">
            <div className="tbar">
              <button
                className={`tbtn${tab === "overview" ? " on" : ""}`}
                onClick={() => setTab("overview")}
              >
                Visão Geral
              </button>
              <button
                className={`tbtn${tab === "dns" ? " on" : ""}`}
                onClick={() => setTab("dns")}
              >
                Registros DNS
              </button>
              <button
                className={`tbtn${tab === "bulk" ? " on" : ""}`}
                onClick={() => setTab("bulk")}
              >
                Alteração em Massa
              </button>
            </div>

            {tab === "overview" && (
              <div className="pane pane-overview">
                <DashboardOverview
                  accountId={accountId}
                  onSelectZone={(id) => selectZone(id)}
                />
              </div>
            )}

            {tab === "dns" && (
              <div className="pane">
                {!selZone && (
                  <div className="mblank">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                    </svg>
                    Selecione um domínio na lateral
                  </div>
                )}
                {dnsLoading && (
                  <div>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 36, marginBottom: 8 }} />
                    ))}
                  </div>
                )}
                {selZone && !dnsLoading && (
                  <table className="dtbl">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Nome</th>
                        <th>Conteúdo</th>
                        <th>Proxy</th>
                        <th>TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnsRec.map((r) => {
                        const known = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"];
                        const tc = known.includes(r.type) ? `t${r.type}` : "toth";
                        let nm = r.name.replace("." + zoneName, "");
                        const isRoot = r.name === zoneName;
                        const pa = ["A", "AAAA", "CNAME"].includes(r.type);
                        return (
                          <tr key={r.id}>
                            <td>
                              <span className={`tb ${tc}`}>{r.type}</span>
                            </td>
                            <td className="trunc" style={{ fontWeight: 600 }}>
                              {isRoot ? (
                                <span style={{ color: "var(--txm)" }}>@</span>
                              ) : (
                                nm
                              )}
                            </td>
                            <td className="mono trunc">{r.content}</td>
                            <td>
                              {pa ? (
                                <span className={`pp ${r.proxied ? "pon" : "poff"}`}>
                                  {r.proxied ? "On" : "Off"}
                                </span>
                              ) : (
                                <span className="mono" style={{ color: "var(--txm)" }}>
                                  —
                                </span>
                              )}
                            </td>
                            <td className="mono">{r.ttl === 1 ? "Auto" : `${r.ttl}s`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "bulk" && (
              <div className="pane">
                <div className="card">
                  <h3>Alteração de IP em Massa</h3>
                  <p>Substitua um IP antigo por um novo em todos os registros A dos seus domínios.</p>
                  <label className="flbl" style={{ marginBottom: 8 }}>
                    Escopo
                  </label>
                  <div className="scrow">
                    <button
                      className={`sc${scope === "all" ? " on" : ""}`}
                      onClick={() => {
                        setScope("all");
                        setAffected([]);
                      }}
                    >
                      Todos os domínios
                    </button>
                    <button
                      className={`sc${scope === "selected" ? " on" : ""}`}
                      onClick={() => {
                        setScope("selected");
                        setAffected([]);
                      }}
                      disabled={!selZone}
                    >
                      {selZone ? `Apenas ${selZone.name}` : "Apenas o selecionado"}
                    </button>
                  </div>
                  <div className="chk" onClick={() => setIncludeAAAA(!includeAAAA)}>
                    <div className={`chkb${includeAAAA ? " on" : ""}`}>
                      {includeAAAA && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span>Incluir registros AAAA (IPv6)</span>
                  </div>
                  <div className="ipr">
                    <div className="ipc">
                      <label>IP Atual</label>
                      <input
                        className="tinp"
                        value={oldIp}
                        onChange={(e) => {
                          setOldIp(e.target.value);
                          setAffected([]);
                        }}
                        placeholder="Ex: 192.168.1.1"
                      />
                    </div>
                    <div className="ipc">
                      <label>Novo IP</label>
                      <input
                        className="tinp"
                        value={newIp}
                        onChange={(e) => setNewIp(e.target.value)}
                        placeholder="Ex: 10.0.0.1"
                      />
                    </div>
                    <button className="bta sec" onClick={doPreview} disabled={previewBusy}>
                      {previewBusy ? (
                        <>
                          <span className="spinner" /> Buscando...
                        </>
                      ) : (
                        "Buscar"
                      )}
                    </button>
                  </div>
                </div>

                {affected.length === 0 && oldIp.trim() && !previewBusy && (
                  <div className="wbx">
                    <span>
                      Nenhum registro com o IP <strong>{esc(oldIp.trim())}</strong> no escopo selecionado.
                    </span>
                  </div>
                )}

                {affected.length > 0 && (
                  <div className="card">
                    <h3 style={{ color: "var(--yl)" }}>
                      {affected.length} registro{affected.length !== 1 ? "s" : ""} em {uniqueZones}{" "}
                      domínio{uniqueZones !== 1 ? "s" : ""}
                    </h3>
                    <p>
                      Atualizar de <code className="mono" style={{ color: "var(--rd)" }}>{oldIp}</code> para{" "}
                      <code className="mono" style={{ color: "var(--gn)" }}>{newIp || "..."}</code>
                    </p>
                    <div className="afl">
                      {affected.map((r) => {
                        const tc = ["A", "AAAA"].includes(r.type) ? `t${r.type}` : "toth";
                        const st =
                          r.status === "success" ? (
                            <span className="sok">✓ ok</span>
                          ) : r.status === "error" ? (
                            <span className="ser">✕ erro</span>
                          ) : (
                            <span className="swt">pendente</span>
                          );
                        return (
                          <div key={r.recordId} className="afr">
                            <span className="afz">{r.zoneName}</span>
                            <span className="afn">{r.name}</span>
                            <span className={`tb ${tc}`}>{r.type}</span>
                            <span className="afi">{r.ip}</span>
                            <span className="afs">{st}</span>
                          </div>
                        );
                      })}
                    </div>
                    {(bulkRunning || bulkProgress > 0) && (
                      <div className="pgb" style={{ display: "block" }}>
                        <div className="pgf" style={{ width: `${bulkProgress}%` }} />
                      </div>
                    )}
                    <div style={{ marginTop: 20 }}>
                      <button
                        className="bta"
                        disabled={!newIp.trim() || bulkRunning}
                        onClick={() => {
                          setConfirmText("");
                          setShowConfirm(true);
                        }}
                      >
                        Aplicar Alteração
                      </button>
                      {bulkSummary && (
                        <span style={{ marginLeft: 12, color: "var(--gn)" }}>{bulkSummary}</span>
                      )}
                      {bulkDone && bulkSummary && null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div
          className="confirm-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowConfirm(false)}
        >
          <div className="confirm-modal">
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "var(--yl)" }}>
              Confirmar Alteração em Massa
            </h3>
            <div
              style={{
                background: "var(--sf2)",
                border: "1px solid var(--bd)",
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: 10,
                    background: "var(--rdd)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--rd)", marginBottom: 4 }}>IP ATUAL</div>
                  <div style={{ fontFamily: "var(--mono)", color: "var(--rd)" }}>{oldIp}</div>
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: 10,
                    background: "var(--gnd)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--gn)", marginBottom: 4 }}>NOVO IP</div>
                  <div style={{ fontFamily: "var(--mono)", color: "var(--gn)" }}>{newIp}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--txd)" }}>
                <strong style={{ color: "var(--tx)" }}>{affected.length}</strong> registro
                {affected.length !== 1 ? "s" : ""} ·{" "}
                <strong style={{ color: "var(--tx)" }}>{uniqueZones}</strong> domínio
                {uniqueZones !== 1 ? "s" : ""}
              </div>
            </div>
            <label className="flbl">Digite CONFIRMAR para prosseguir</label>
            <input
              className="tinp"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRMAR"
              autoComplete="off"
              style={{ marginBottom: 20, textTransform: "uppercase" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="bta sec" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button
                className="bta"
                style={{ background: "var(--rd)" }}
                disabled={confirmText.trim().toUpperCase() !== "CONFIRMAR"}
                onClick={execBulk}
              >
                Aplicar Alteração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
