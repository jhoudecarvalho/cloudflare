"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DashboardOverview from "@/components/DashboardOverview";
import LoginScreen from "@/components/LoginScreen";
import { fetchAllZones } from "@/lib/cf-client";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [zoneCount, setZoneCount] = useState(0);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setAccountId(data.accountId || "");
        setAuthenticated(true);
        const zones = await fetchAllZones();
        setZoneCount(zones.length);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const doLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuthenticated(false);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="login-screen">
        <span className="spinner" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onSuccess={() => loadSession()} />;
  }

  return (
    <AppShell
      active="dashboard"
      zoneCount={zoneCount}
      onLogout={doLogout}
    >
      <div className="pane pane-overview dash-page">
        <DashboardOverview
          accountId={accountId}
          onSelectZone={(id) => router.push(`/dns?zone=${id}`)}
        />
      </div>
    </AppShell>
  );
}
