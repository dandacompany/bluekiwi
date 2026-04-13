"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/context";
import { DeleteUserDialog } from "./delete-user-dialog";

interface ProfileTabProps {
  user: { userId: number; username: string; email: string; role: string };
}

export function ProfileTab({ user }: ProfileTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(user.username);
  const [saving, setSaving] = useState(false);

  const isDirty = name.trim() !== user.username;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("settings.nameRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? t("settings.saveFailed"));
      }

      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("settings.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-[var(--muted-foreground)]" />
          <CardTitle>{t("settings.profileInfo")}</CardTitle>
        </div>
        <CardDescription>{t("settings.profileDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <label
            htmlFor="profile-name"
            className="text-sm font-medium text-[var(--foreground)]"
          >
            {t("settings.name")}
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.namePlaceholder")}
          />
        </div>

        {/* Email (readonly) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("settings.email")}
          </label>
          <Input value={user.email} readOnly className="opacity-60" />
        </div>

        {/* Role (readonly) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("settings.role")}
          </label>
          <div>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !isDirty} size="sm">
          <Save className="h-4 w-4" />
          {saving ? t("settings.saving") : t("common.save")}
        </Button>

        {/* Danger Zone — account deletion (not for superuser) */}
        {user.role !== "superuser" && (
          <div className="mt-8 border-t border-[var(--destructive)]/30 pt-6">
            <h3 className="text-sm font-semibold text-[var(--destructive)]">
              {t("deleteAccount.title")}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {t("deleteAccount.description")}
            </p>
            <DeleteUserDialog
              target={{
                id: user.userId,
                username: user.username,
                role: user.role,
              }}
              isSelf
              trigger={
                <Button variant="destructive" size="sm" className="mt-3">
                  <Trash2 className="h-4 w-4" />
                  {t("deleteAccount.button")}
                </Button>
              }
              onSuccess={() => {
                // Clear session and redirect to login
                fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                  router.push("/login");
                });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
