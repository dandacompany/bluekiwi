"use client";

import { useState } from "react";
import { Save, User } from "lucide-react";
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

interface ProfileTabProps {
  user: { userId: number; username: string; email: string; role: string };
}

export function ProfileTab({ user }: ProfileTabProps) {
  const { t } = useTranslation();
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
      </CardContent>
    </Card>
  );
}
