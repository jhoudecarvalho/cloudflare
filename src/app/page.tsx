"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => {
        if (r.ok) router.replace("/dashboard");
      })
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="login-screen">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <LoginScreen onSuccess={() => router.replace("/dashboard")} />
  );
}
