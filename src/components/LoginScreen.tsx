"use client";

import { useState } from "react";

type Props = {
  onSuccess: () => void;
};

export default function LoginScreen({ onSuccess }: Props) {
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const doLogin = async () => {
    if (!token.trim() || !accountId.trim()) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountId: accountId.trim(),
          token: token.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Falha no login");
      setToken("");
      onSuccess();
    } catch (e) {
      setLoginError("✕ " + (e instanceof Error ? e.message : "Erro"));
    }
    setLoginBusy(false);
  };

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
          Permissões: <strong>Analytics:Read</strong>, <strong>Zone:Read</strong>,{" "}
          <strong>DNS:Edit</strong>.
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
