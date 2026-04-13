"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

interface InviteInfo {
  email: string;
  role: string;
  inviter?: string;
  expires_at: string;
}

export default function InvitePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{
    api_key: string;
    server_url: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/invites/accept/${token}`)
      .then(async (response) => {
        if (response.ok) {
          setInvite(await response.json());
          return;
        }
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "network_error");
      })
      .catch(() => setError("network_error"));
  }, [token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch(`/api/invites/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await response.json()) as {
      api_key?: string;
      server_url?: string;
      error?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "network_error");
      return;
    }

    setResult({
      api_key: data.api_key ?? "",
      server_url: data.server_url ?? "http://localhost:3100",
    });
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <Card>
          <CardContent className="py-10 text-center text-sm">
            {t(`invite.error.${error}`)}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (result) {
    const command = `npm i -g bluekiwi && bluekiwi accept ${token} --server ${result.server_url}`;

    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <Card>
          <CardHeader>
            <CardTitle>{t("invite.success.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{t("invite.success.installHint")}</p>
            <div className="flex w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted)]">
              <input
                readOnly
                value={command}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-[var(--foreground)] outline-none"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(command)}
                className="flex shrink-0 items-center gap-1.5 border-l border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("common.copy")}
              </button>
            </div>
            <Button variant="outline" onClick={() => router.push("/login")}>
              {t("invite.success.goLogin")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm">
        {t("common.loading")}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <Card>
        <CardHeader>
          <CardTitle>{t("invite.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">
            {t("invite.body", { email: invite.email, role: invite.role })}
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder={t("invite.username")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={t("invite.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              {t("invite.accept")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
