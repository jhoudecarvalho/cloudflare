"use client";

import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

type Props = {
  active: "dashboard" | "dns";
  zoneCount?: number;
  children: React.ReactNode;
  onLogout: () => void;
};

export default function AppShell({
  active,
  zoneCount,
  children,
  onLogout,
}: Props) {
  return (
    <div className="dashboard vis">
      <div className="topbar">
        <div className="topbar-l">
          <h2>
            Cloud<em>flare</em> Hub
          </h2>
          {zoneCount !== undefined && (
            <span className="cnt">
              {zoneCount} domínio{zoneCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="ver-badge">v{APP_VERSION}</span>
        </div>
        <nav className="app-nav">
          <Link
            href="/hub"
            className={`nav-link${active === "dashboard" ? " on" : ""}`}
          >
            Dashboard
          </Link>
          <Link href="/dns" className={`nav-link${active === "dns" ? " on" : ""}`}>
            DNS
          </Link>
        </nav>
        <button className="btn-sm" onClick={onLogout}>
          Sair
        </button>
      </div>
      <div className="app-main">{children}</div>
    </div>
  );
}
