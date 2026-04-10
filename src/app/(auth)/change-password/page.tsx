"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 6) {
      setError(t("changePassword.minLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("changePassword.changeFailed"));
        return;
      }

      toast.success(t("changePassword.changed"));
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
          <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <Lock className="h-3.5 w-3.5" />
            <span>{t("changePassword.title")}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("changePassword.currentPassword")}
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("changePassword.currentPasswordPlaceholder")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("changePassword.newPassword")}
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("changePassword.newPasswordPlaceholder")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
              {t("changePassword.confirmNewPassword")}
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("changePassword.confirmNewPasswordPlaceholder")}
              required
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-[var(--destructive)]">{error}</p>
        )}

        <Button type="submit" className="mt-4 w-full" disabled={loading}>
          {loading
            ? t("changePassword.changing")
            : t("changePassword.changeButton")}
        </Button>
      </form>
    </div>
  );
}
