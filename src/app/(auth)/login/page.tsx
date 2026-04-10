"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to setup if no users exist
  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.needsSetup) router.replace("/setup");
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.loginFailed"));
        return;
      }

      if (data.must_change_password) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(t("auth.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-6 text-center">
          <Image
            src="/logo-96.png"
            alt={t("auth.logoAlt")}
            className="mx-auto mb-2 h-14 w-14 rounded-2xl"
            width={56}
            height={56}
          />
          <h1 className="text-lg font-semibold text-[var(--foreground)]">
            BlueKiwi
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("auth.brandTagline")}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("auth.email")}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("auth.password")}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              required
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-[var(--destructive)]">{error}</p>
        )}

        <Button type="submit" className="mt-4 w-full" disabled={loading}>
          {loading ? t("auth.loggingIn") : t("auth.loginButton")}
        </Button>

        <p className="mt-4 text-center text-[11px] text-[var(--muted-foreground)]">
          {t("auth.noAccount")}{" "}
          <span className="font-medium text-[var(--primary)]">
            {t("auth.contactAdmin")}
          </span>
        </p>
      </form>
    </div>
  );
}
