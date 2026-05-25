"use client";

import { Suspense } from "react";
import DnsManager from "@/components/DnsManager";

export default function DnsPage() {
  return (
    <Suspense
      fallback={
        <div className="login-screen">
          <span className="spinner" />
        </div>
      }
    >
      <DnsManager embedded />
    </Suspense>
  );
}
