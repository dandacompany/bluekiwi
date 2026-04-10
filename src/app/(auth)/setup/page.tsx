"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

export default function SetupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect if setup is already done
  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => {
        if (!d.needsSetup) router.replace("/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("setup.passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("setup.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("setup.setupFailed"));
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

  if (checking) return null;

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
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("setup.title")}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("setup.name")}
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("setup.namePlaceholder")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("auth.email")}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("setup.emailPlaceholder")}
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
              placeholder={t("setup.passwordPlaceholder")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("setup.confirmPassword")}
            </label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("setup.confirmPlaceholder")}
              required
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-[var(--destructive)]">{error}</p>
        )}

        <Button type="submit" className="mt-4 w-full" disabled={loading}>
          {loading ? t("setup.creating") : t("setup.createButton")}
        </Button>

        <p className="mt-4 text-center text-[10px] text-[var(--muted-foreground)]">
          {t("setup.superuserNote")}
        </p>
      </form>
    </div>
  );
}
